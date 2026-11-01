# Deployment

This project is a standard Next.js application and can run on a Node.js host or in a Docker container. Application data, uploaded images, and login rate-limit state are stored in external services (Supabase and Upstash), not on the host's local filesystem.

## Runtime requirements

- Node.js 22 LTS (Node.js 20.9 or later is required by the current Next.js line).
- npm.
- A host that supports a persistent Node.js web process, or Docker.

## Required environment variables

Configure these in the deployment platform's environment-variable settings. Never commit real credentials.

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Keep this server-side only.
- `SESSION_SECRET`: A random secret with at least 32 characters.
- `ADMIN_PASSWORD`: Initial administrator password used by the application's admin bootstrap.
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL, used for login rate limiting.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token.

The Supabase project must have the `app_state` table and the `uploads` Storage bucket configured as required by the application.

## Generic Node.js deployment

- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Set the service's port through the standard `PORT` environment variable.
- Bind the web service to `0.0.0.0`.

## Render Web Service

For a native Node.js service:

- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Branch: `master`
- Add all required environment variables above.

For a Docker service, choose the Docker runtime and use the repository-root `Dockerfile`.

Render Free services sleep after inactivity and use an ephemeral filesystem. This app keeps its persistent application data and uploaded files in Supabase, so it does not rely on local disk persistence. Free instances may still have cold-start delays and resource limits.

## Docker

Build and run locally:

```sh
docker build -t sakura-game-archive .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e SUPABASE_URL="..." \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e SESSION_SECRET="..." \
  -e ADMIN_PASSWORD="..." \
  -e UPSTASH_REDIS_REST_URL="..." \
  -e UPSTASH_REDIS_REST_TOKEN="..." \
  sakura-game-archive
```

Do not bake secrets into the Docker image or commit local environment files.

## Portability notes

The app uses standard Node.js APIs for server routes and does not require Netlify-specific runtime APIs. Client IP logging uses common forwarded-IP headers; the exact client IP available depends on the proxy in front of the app.

Some serverless platforms impose request-body limits that are lower than this app's 50 MB photo-wall upload allowance. Confirm the target host's request-size limit before choosing a serverless deployment, or change uploads to go directly from the browser to object storage.
