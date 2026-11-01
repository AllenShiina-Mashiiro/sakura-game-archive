-- Run after 202611010001_database_2_beta.sql.
-- Every legacy_count should match normalized_count before enabling DATABASE_V2_ENABLED.

with source as (
  select data from public.app_state where id = 'main'
), counts as (
  select 'users' as entity, jsonb_array_length(coalesce(data->'users','[]'::jsonb)) as legacy_count,
    (select count(*)::int from public.archive_users) as normalized_count from source
  union all select 'games', jsonb_array_length(coalesce(data->'games','[]'::jsonb)), (select count(*)::int from public.archive_games) from source
  union all select 'resources', jsonb_array_length(coalesce(data->'resources','[]'::jsonb)), (select count(*)::int from public.archive_resources) from source
  union all select 'guides', jsonb_array_length(coalesce(data->'guides','[]'::jsonb)), (select count(*)::int from public.archive_guides) from source
  union all select 'feedback', jsonb_array_length(coalesce(data->'feedback','[]'::jsonb)), (select count(*)::int from public.archive_feedback) from source
  union all select 'notices', jsonb_array_length(coalesce(data->'notices','[]'::jsonb)), (select count(*)::int from public.archive_notices) from source
  union all select 'collections', jsonb_array_length(coalesce(data->'collections','[]'::jsonb)), (select count(*)::int from public.archive_collections) from source
  union all select 'loginLogs', jsonb_array_length(coalesce(data->'loginLogs','[]'::jsonb)), (select count(*)::int from public.archive_login_logs) from source
  union all select 'comments', jsonb_array_length(coalesce(data->'comments','[]'::jsonb)), (select count(*)::int from public.archive_comments) from source
  union all select 'photos', jsonb_array_length(coalesce(data->'photos','[]'::jsonb)), (select count(*)::int from public.archive_photos) from source
  union all select 'shopProducts', jsonb_array_length(coalesce(data->'shopProducts','[]'::jsonb)), (select count(*)::int from public.archive_shop_products) from source
  union all select 'inventory', jsonb_array_length(coalesce(data->'inventory','[]'::jsonb)), (select count(*)::int from public.archive_inventory) from source
  union all select 'coinTransactions', jsonb_array_length(coalesce(data->'coinTransactions','[]'::jsonb)), (select count(*)::int from public.archive_coin_transactions) from source
  union all select 'messages', jsonb_array_length(coalesce(data->'messages','[]'::jsonb)), (select count(*)::int from public.archive_messages) from source
  union all select 'friendships', jsonb_array_length(coalesce(data->'friendships','[]'::jsonb)), (select count(*)::int from public.archive_friendships) from source
  union all select 'notifications', jsonb_array_length(coalesce(data->'notifications','[]'::jsonb)), (select count(*)::int from public.archive_notifications) from source
  union all select 'contributors', jsonb_array_length(coalesce(data->'contributors','[]'::jsonb)), (select count(*)::int from public.archive_contributors) from source
  union all select 'gameGuides', (
    select coalesce(sum(jsonb_array_length(case when jsonb_typeof(games.game->'guides')='array' then games.game->'guides' else '[]'::jsonb end)),0)::int
    from jsonb_array_elements(coalesce(data->'games','[]'::jsonb)) as games(game)
  ), (select count(*)::int from public.archive_game_guides) from source
)
select entity, legacy_count, normalized_count,
       (legacy_count = normalized_count) as matches
from counts
order by entity;
