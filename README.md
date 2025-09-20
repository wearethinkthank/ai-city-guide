# Vibe Events

Minimal pnpm + Turborepo workspace bootstrapping the Vibe Events MVP. It ships with a Next.js web app, a Fastify API with BullMQ + Prisma, and a shared TypeScript utilities package.

## Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL instance
- Redis instance

## Getting Started
1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Copy the environment template and tweak values as needed:
   ```sh
   cp .env.example .env
   ```
3. Generate the Prisma client and apply migrations:
   ```sh
   cd apps/api
   npx prisma generate
   npx prisma migrate dev
   ```
4. Run the dev services. In one terminal start the API and worker:
   ```sh
   pnpm dev:api
   pnpm dev:worker
   ```
   In another terminal start the web client:
   ```sh
   pnpm dev:web
   ```

The web client talks to the API via relative paths during local development. When deploying, set `NEXT_PUBLIC_API_BASE` to the deployed API origin.

## Environment Variables
The root `.env.example` lists the required values:
```
DATABASE_URL=postgres://USER:PASS@HOST:PORT/DB
REDIS_URL=redis://HOST:PORT
SONGKICK_API_KEY=
NEXT_PUBLIC_APP_NAME=Vibe Events
```
- Railway: provide `DATABASE_URL` and `REDIS_URL` secrets for the API.
- Vercel (or similar): expose `NEXT_PUBLIC_APP_NAME` and, if the API is remote, `NEXT_PUBLIC_API_BASE` so the web app can reach the API.

## Available Scripts
- `pnpm dev` — runs turbo’s aggregated `dev` pipeline.
- `pnpm build` — builds all packages/apps via Turborepo.
- `pnpm lint` — runs the monorepo lint pipeline.
- `pnpm typecheck` — runs TypeScript checks across the workspace.
- Package-specific scripts are available via `pnpm --filter <name> <script>`.

## Project Structure
```
apps/
  api/    Fastify API, BullMQ worker, Prisma models
  web/    Next.js 14 App Router client with Tailwind
packages/
  shared/ Zod schemas and small helpers shared across the monorepo
```
