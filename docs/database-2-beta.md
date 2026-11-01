# Database 2.0 Beta — v2.23

## Architecture

The current application stores the full domain model in `app_state.data` (one JSONB document). The Beta migration adds independent entity tables while retaining `app_state` as a compatibility snapshot and optimistic-lock version counter.

The normalized tables include users, games, resources, community guides, game-specific guides, feedback, notices, collections, login logs, comments, photos, shop products, inventory, coin transactions, messages, friendships, notifications, contributors and site settings. Each entity row retains its complete source object in `row_data`; common owner and creation fields are separately indexed. RLS is enabled and there are no browser-facing policies. The application uses the server-only Supabase service-role client.

## Safe migration procedure

1. Take a full Supabase database backup (and verify it can be restored).
2. Deploy this code with `DATABASE_V2_ENABLED=false`. Do not enable the flag yet.
3. In Supabase SQL Editor, run `supabase/migrations/202611010001_database_2_beta.sql` against the production project.
4. Verify `archive_schema_migrations` contains `2.23.0-beta.1`; compare row counts in each `archive_*` table against the corresponding JSON array lengths in `app_state.data`.
5. Put the site into a short maintenance window. Stop/disable old Netlify, DockHosting and other deployments that still write directly to `app_state`. Mixed old/new writers are not supported during cutover.
6. Set `DATABASE_V2_ENABLED=true` on the new deployment and restart/redeploy. The app checks the migration marker before reading; it will fail closed rather than silently return empty data if the SQL migration is missing.
7. Test login, profile update, game edit, feedback, friend request, private message, notification read state, uploads and admin operations. Confirm both normalized tables and `app_state.version` advance on writes.
8. Keep the backup and `app_state` snapshot for the rollback period. Do not drop `app_state` in Beta.

## Transaction and compatibility behavior

With the flag enabled, reads are assembled from the normalized entity tables. Writes call `archive_save_snapshot`, which performs an optimistic version check, updates `app_state`, replaces the normalized rows and updates nested game guides in a single Postgres transaction. A concurrent write returns false and the application asks the user to refresh instead of overwriting newer data.

This is a transitional compatibility layer: existing application features still operate on the typed in-memory `Database` object, and the RPC currently replaces the entity-table snapshots per write. It separates storage by domain and protects consistency, but it is not yet the final per-entity query/repository architecture for high-write workloads. The next optimization phase should move hot paths (messages, notifications, feedback, comments) to targeted SQL operations so they no longer rewrite every table on each mutation.

## Rollback

1. Set `DATABASE_V2_ENABLED=false` and redeploy/restart the app.
2. The app returns to reading and writing `app_state.data`.
3. Do not drop normalized tables until the rollback window closes. If the Beta flag was enabled, every successful write also updated `app_state` in the same transaction, so the legacy snapshot remains current.
4. If the database itself must be restored, use the verified Supabase backup rather than manually deleting rows.

## Portability

The migration is plain PostgreSQL/Supabase SQL. The Next.js application still uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side. Netlify, Docker/DockHosting, Vercel and other Node-compatible hosts need the same environment variables; keep `DATABASE_V2_ENABLED=false` until the database migration and cutover checks are complete. Never expose the service-role key to client-side code.
