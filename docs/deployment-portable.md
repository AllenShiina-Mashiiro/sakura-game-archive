# Portable deployment guide (v2.23)

This project uses the standard Next.js production server and does not require Vercel-specific hosting APIs. The same container can run on Dockhosting, a VPS, a Docker host, or a domestic platform that supports Docker. Netlify remains supported through its Next.js adapter, subject to account build/runtime limits.

## Required environment

Set these variables in the hosting platform's secret/environment settings:

- `SESSION_SECRET`: random secret with at least 32 characters.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key. Never expose it with a `NEXT_PUBLIC_` prefix.
- `DATABASE_V2_ENABLED`: keep `false` until the deployed application and database migration have been explicitly verified together. The current migration is a compatibility snapshot migration; it does not mean every domain entity is independently queried by the application.

Do not commit production secrets or upload a production `.env` file.

## Docker / Dockhosting / VPS

The repository includes `Dockerfile`, `.dockerignore`, and `compose.yaml`.

1. Connect the GitHub repository to the Docker-capable host, or clone the repository on the server.
2. Select branch `release/v2.23` for staging; do not point production to this branch until acceptance testing is complete.
3. Set the required environment variables in the host's secret manager.
4. Build with `docker build -t sakura-game-archive:2.23.0 .`.
5. Run with `docker compose up -d --build`.
6. Expose container port 3000 through the host's HTTPS reverse proxy.
7. Configure reverse-proxy upload body limits to at least 55 MB for the photo wall, and set suitable request/read timeouts.
8. Verify login, uploads, images, private messages, feedback, and administrator actions before production cutover.

The Compose file publishes the application port and includes a basic HTTP health check. Configure the public domain, TLS certificate, backup, and firewall at the hosting provider/reverse proxy; these are provider-specific.

## Node.js host without Docker

Use Node.js 22:

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm run start
```

Set the same environment variables and bind the service to the provider's assigned port. For a direct process manager, use `npm run start -- --hostname 0.0.0.0 --port $PORT`.

## Netlify

Use the repository's Netlify Next.js adapter and the normal build command `npm run build`. Add the required server environment variables in Netlify's site settings. A successful local Docker build does not prove that the Netlify account has enough build minutes/bandwidth; check the account quota before enabling production deploys.

## Rollback

Keep the previous image/tag and deployment configuration. Roll back the application image first if a deployment fails. Do not drop or truncate `app_state` or the pre-migration backup table. Do not toggle `DATABASE_V2_ENABLED` without checking which schema the deployed code expects.

## Current scope and limitations

- The application still uses the snapshot compatibility API in `lib/db.ts`; the normalized Beta tables are populated by migration functions but the app has not yet been refactored into per-entity SQL queries. Do not describe this as a fully normalized production data layer.
- The media proxy currently targets public objects in the configured Supabase `uploads` bucket. It is not a general-purpose proxy for arbitrary media hosts or video streaming.
- Validate real streaming playback and CDN/range-request behavior on the target host before claiming streaming performance is fixed.
- Multi-instance deployments should be treated as unverified until authentication/session behavior, storage, concurrent writes, and reverse-proxy configuration have been load-tested.
