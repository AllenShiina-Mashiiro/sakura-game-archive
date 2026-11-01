-- Sakura Game Archive v2.23 / Database 2.0 Beta
-- Safe, additive migration. It DOES NOT drop or alter app_state.
-- Run after taking a Supabase backup. All legacy JSON rows remain the source of truth
-- until the application is explicitly switched and verified.

create table if not exists public.archive_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

create or replace function public.archive_create_entity_table(p_table text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  execute format(
    'create table if not exists public.%I (
      id text primary key,
      owner_id text,
      created_at timestamptz,
      row_data jsonb not null,
      migrated_at timestamptz not null default now()
    )', p_table
  );
  execute format('create index if not exists %I on public.%I (owner_id)', p_table || '_owner_idx', p_table);
  execute format('create index if not exists %I on public.%I (created_at desc)', p_table || '_created_idx', p_table);
  execute format('alter table public.%I enable row level security', p_table);
end;
$$;

select public.archive_create_entity_table('archive_users');
select public.archive_create_entity_table('archive_games');
select public.archive_create_entity_table('archive_resources');
select public.archive_create_entity_table('archive_guides');
select public.archive_create_entity_table('archive_game_guides');
select public.archive_create_entity_table('archive_feedback');
select public.archive_create_entity_table('archive_notices');
select public.archive_create_entity_table('archive_collections');
select public.archive_create_entity_table('archive_login_logs');
select public.archive_create_entity_table('archive_comments');
select public.archive_create_entity_table('archive_photos');
select public.archive_create_entity_table('archive_shop_products');
select public.archive_create_entity_table('archive_inventory');
select public.archive_create_entity_table('archive_coin_transactions');
select public.archive_create_entity_table('archive_messages');
select public.archive_create_entity_table('archive_friendships');
select public.archive_create_entity_table('archive_notifications');
select public.archive_create_entity_table('archive_contributors');

create table if not exists public.archive_site_settings (
  id text primary key default 'main' check (id = 'main'),
  row_data jsonb not null default '{}'::jsonb,
  migrated_at timestamptz not null default now()
);
alter table public.archive_site_settings enable row level security;

-- Import one legacy app_state snapshot. Re-running is safe and updates the snapshot rows.
do $$
declare
  source_data jsonb;
  spec record;
  item jsonb;
  entity_id text;
  owner text;
  created timestamptz;
  specs constant text[][] := array[
    ['users','archive_users','id','createdAt'],
    ['games','archive_games','id','updatedAt'],
    ['resources','archive_resources','id','updatedAt'],
    ['guides','archive_guides','id','date'],
    ['feedback','archive_feedback','id','createdAt'],
    ['notices','archive_notices','id','updatedAt'],
    ['collections','archive_collections','id','createdAt'],
    ['loginLogs','archive_login_logs','id','date'],
    ['comments','archive_comments','id','createdAt'],
    ['photos','archive_photos','id','createdAt'],
    ['shopProducts','archive_shop_products','id','createdAt'],
    ['inventory','archive_inventory','id','purchasedAt'],
    ['coinTransactions','archive_coin_transactions','id','createdAt'],
    ['messages','archive_messages','id','createdAt'],
    ['friendships','archive_friendships','id','createdAt'],
    ['notifications','archive_notifications','id','createdAt'],
    ['contributors','archive_contributors','id','createdAt']
  ];
begin
  select data into source_data from public.app_state where id = 'main';
  if source_data is null then
    raise exception 'app_state/main not found; refusing to migrate an empty source';
  end if;

  foreach spec slice 1 in array specs loop
    for item in
      select value from jsonb_array_elements(
        case when jsonb_typeof(source_data -> spec[1]) = 'array'
          then source_data -> spec[1] else '[]'::jsonb end
      )
    loop
      entity_id := coalesce(item ->> spec[3], item ->> 'username', item ->> 'slug');
      if entity_id is null or entity_id = '' then
        raise exception 'Missing entity id in app_state key %', spec[1];
      end if;
      owner := coalesce(item ->> 'userId', item ->> 'ownerId', item ->> 'requesterId');
      begin
        created := nullif(coalesce(item ->> spec[4], item ->> 'created_at'), '')::timestamptz;
      exception when others then
        created := null;
      end;
      execute format(
        'insert into public.%I (id, owner_id, created_at, row_data) values ($1,$2,$3,$4)
         on conflict (id) do update set owner_id=excluded.owner_id,
           created_at=excluded.created_at, row_data=excluded.row_data, migrated_at=now()',
        spec[2]
      ) using entity_id, owner, created, item;
    end loop;
  end loop;

  -- Game-specific nested guides are preserved separately to avoid ID collisions
  -- with top-level community guides.
  for item in
    select jsonb_build_object('gameId', g ->> 'id', 'guide', guide)
    from jsonb_array_elements(coalesce(source_data -> 'games', '[]'::jsonb)) g
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(g -> 'guides') = 'array' then g -> 'guides' else '[]'::jsonb end
    ) guide
  loop
    entity_id := coalesce(item #>> '{guide,id}', item #>> '{guide,title}');
    if entity_id is null then raise exception 'Nested game guide missing id/title'; end if;
    execute 'insert into public.archive_game_guides(id, owner_id, row_data) values ($1,$2,$3)
      on conflict (id) do update set owner_id=excluded.owner_id,row_data=excluded.row_data,migrated_at=now()'
      using (item #>> '{gameId}') || ':' || entity_id,
            item #>> '{guide,userId}', item;
  end loop;

  insert into public.archive_site_settings(id, row_data)
  values ('main', coalesce(source_data -> 'siteSettings', '{}'::jsonb))
  on conflict (id) do update set row_data=excluded.row_data, migrated_at=now();

  insert into public.archive_schema_migrations(version, notes)
  values ('2.23.0-beta.1', 'Additive normalized entity tables; app_state retained; imported legacy snapshot')
  on conflict (version) do update set notes=excluded.notes;
end $$;

-- Tables intentionally have no anon/authenticated policies. The server service-role
-- client bypasses RLS; never expose SUPABASE_SERVICE_ROLE_KEY to browser code.
drop function if exists public.archive_create_entity_table(text);
