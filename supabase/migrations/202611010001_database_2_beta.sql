-- Sakura Game Archive v2.23 / Database 2.0 Beta
-- Safe, additive migration. It DOES NOT drop or alter app_state.
-- Run after taking a Supabase backup. All legacy JSON rows remain the source of truth
-- until the application is explicitly switched and verified.

create table if not exists public.archive_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  notes text
);
alter table public.archive_schema_migrations enable row level security;

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
  
begin
  select data into source_data from public.app_state where id = 'main';
  if source_data is null then
    raise exception 'app_state/main not found; refusing to migrate an empty source';
  end if;

  for spec in select * from (values
    ('users','archive_users','id','createdAt'),
    ('games','archive_games','id','updatedAt'),
    ('resources','archive_resources','id','updatedAt'),
    ('guides','archive_guides','id','date'),
    ('feedback','archive_feedback','id','createdAt'),
    ('notices','archive_notices','id','updatedAt'),
    ('collections','archive_collections','id','createdAt'),
    ('loginLogs','archive_login_logs','id','date'),
    ('comments','archive_comments','id','createdAt'),
    ('photos','archive_photos','id','createdAt'),
    ('shopProducts','archive_shop_products','id','createdAt'),
    ('inventory','archive_inventory','id','purchasedAt'),
    ('coinTransactions','archive_coin_transactions','id','createdAt'),
    ('messages','archive_messages','id','createdAt'),
    ('friendships','archive_friendships','id','createdAt'),
    ('notifications','archive_notifications','id','createdAt'),
    ('contributors','archive_contributors','id','createdAt')
  ) as mapping(array_key, table_name, id_key, date_key) loop
    for item in
      select value from jsonb_array_elements(
        case when jsonb_typeof(source_data -> spec.array_key) = 'array'
          then source_data -> spec.array_key else '[]'::jsonb end
      )
    loop
      entity_id := coalesce(item ->> spec.id_key, item ->> 'username', item ->> 'slug');
      if entity_id is null or entity_id = '' then
        raise exception 'Missing entity id in app_state key %', spec.array_key;
      end if;
      owner := coalesce(item ->> 'userId', item ->> 'ownerId', item ->> 'requesterId');
      begin
        created := nullif(coalesce(item ->> spec.date_key, item ->> 'created_at'), '')::timestamptz;
      exception when others then
        created := null;
      end;
      execute format(
        'insert into public.%I (id, owner_id, created_at, row_data) values ($1,$2,$3,$4)
         on conflict (id) do update set owner_id=excluded.owner_id,
           created_at=excluded.created_at, row_data=excluded.row_data, migrated_at=now()',
        spec.table_name
      ) using entity_id, owner, created, item;
    end loop;
  end loop;

  update public.archive_games set row_data = row_data - 'guides';

  -- Game-specific nested guides are preserved separately to avoid ID collisions
  -- with top-level community guides.
  for item in
    select jsonb_build_object('gameId', games.game ->> 'id', 'guide', nested.guide)
    from jsonb_array_elements(coalesce(source_data -> 'games', '[]'::jsonb)) as games(game)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(games.game -> 'guides') = 'array' then games.game -> 'guides' else '[]'::jsonb end
    ) as nested(guide)
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


-- Runtime compatibility layer. When DATABASE_V2_ENABLED=true, the app reads normalized
-- entity tables and writes the legacy snapshot + normalized tables in one transaction.
create or replace function public.archive_replace_entity_table(
  p_table text, p_rows jsonb, p_owner_key text, p_date_key text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  execute format('delete from public.%I', p_table);
  execute format(
    'insert into public.%I (id, owner_id, created_at, row_data)
     select coalesce(items.value->>''id'', items.value->>''username'', items.value->>''slug''),
            coalesce(items.value->>$1, items.value->>''ownerId'', items.value->>''requesterId''),
            case when coalesce(items.value->>$2, items.value->>''created_at'') ~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}''
              then (coalesce(items.value->>$2, items.value->>''created_at''))::timestamptz else null end,
            items.value
     from jsonb_array_elements(case when jsonb_typeof($3) = ''array'' then $3 else ''[]''::jsonb end) as items(value)',
    p_table
  ) using p_owner_key, p_date_key, p_rows;
end;
$$;

create or replace function public.archive_load_snapshot()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(row_data) from public.archive_users), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_set(g.row_data, '{guides}', coalesce((
        select jsonb_agg(gg.row_data->'guide')
        from public.archive_game_guides gg
        where gg.row_data->>'gameId' = g.id
      ), '[]'::jsonb), true))
      from public.archive_games g
    ), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(row_data) from public.archive_resources), '[]'::jsonb),
    'guides', coalesce((select jsonb_agg(row_data) from public.archive_guides), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(row_data) from public.archive_feedback), '[]'::jsonb),
    'notices', coalesce((select jsonb_agg(row_data) from public.archive_notices), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(row_data) from public.archive_collections), '[]'::jsonb),
    'loginLogs', coalesce((select jsonb_agg(row_data) from public.archive_login_logs), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(row_data) from public.archive_comments), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(row_data) from public.archive_photos), '[]'::jsonb),
    'shopProducts', coalesce((select jsonb_agg(row_data) from public.archive_shop_products), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(row_data) from public.archive_inventory), '[]'::jsonb),
    'coinTransactions', coalesce((select jsonb_agg(row_data) from public.archive_coin_transactions), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(row_data) from public.archive_messages), '[]'::jsonb),
    'friendships', coalesce((select jsonb_agg(row_data) from public.archive_friendships), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(row_data) from public.archive_notifications), '[]'::jsonb),
    'contributors', coalesce((select jsonb_agg(row_data) from public.archive_contributors), '[]'::jsonb),
    'siteSettings', coalesce((select row_data from public.archive_site_settings where id='main'), '{}'::jsonb)
  );
$$;

create or replace function public.archive_save_snapshot(p_data jsonb, p_expected_version bigint)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  changed integer;
begin
  update public.app_state
    set data = p_data, version = p_expected_version + 1, updated_at = now()
    where id = 'main' and version = p_expected_version;
  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;

  perform public.archive_replace_entity_table('archive_users', p_data->'users', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_games', p_data->'games', 'userId', 'updatedAt');
  update public.archive_games set row_data = row_data - 'guides';
  perform public.archive_replace_entity_table('archive_resources', p_data->'resources', 'userId', 'updatedAt');
  perform public.archive_replace_entity_table('archive_guides', p_data->'guides', 'userId', 'date');
  perform public.archive_replace_entity_table('archive_feedback', p_data->'feedback', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_notices', p_data->'notices', 'userId', 'updatedAt');
  perform public.archive_replace_entity_table('archive_collections', p_data->'collections', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_login_logs', p_data->'loginLogs', 'userId', 'date');
  perform public.archive_replace_entity_table('archive_comments', p_data->'comments', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_photos', p_data->'photos', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_shop_products', p_data->'shopProducts', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_inventory', p_data->'inventory', 'userId', 'purchasedAt');
  perform public.archive_replace_entity_table('archive_coin_transactions', p_data->'coinTransactions', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_messages', p_data->'messages', 'fromId', 'createdAt');
  perform public.archive_replace_entity_table('archive_friendships', p_data->'friendships', 'requesterId', 'createdAt');
  perform public.archive_replace_entity_table('archive_notifications', p_data->'notifications', 'userId', 'createdAt');
  perform public.archive_replace_entity_table('archive_contributors', p_data->'contributors', 'userId', 'createdAt');

  delete from public.archive_game_guides;
  insert into public.archive_game_guides(id, owner_id, row_data)
  select (games.game->>'id') || ':' || coalesce(nested.guide->>'id', nested.guide->>'title'),
         nested.guide->>'userId', jsonb_build_object('gameId', games.game->>'id', 'guide', nested.guide)
  from jsonb_array_elements(coalesce(p_data->'games','[]'::jsonb)) as games(game)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(games.game->'guides')='array' then games.game->'guides' else '[]'::jsonb end
  ) as nested(guide);

  insert into public.archive_site_settings(id,row_data)
  values ('main',coalesce(p_data->'siteSettings','{}'::jsonb))
  on conflict (id) do update set row_data=excluded.row_data,migrated_at=now();
  return true;
end;
$$;

revoke all on function public.archive_load_snapshot() from public, anon, authenticated;
revoke all on function public.archive_save_snapshot(jsonb,bigint) from public, anon, authenticated;
revoke all on function public.archive_replace_entity_table(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.archive_load_snapshot() to service_role;
grant execute on function public.archive_save_snapshot(jsonb,bigint) to service_role;
