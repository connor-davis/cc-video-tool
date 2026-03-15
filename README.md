# CC Video Tool

This app now includes a custom authentication system built with:

- React 19 + Vite + TanStack Router on the client
- Convex for backend HTTP routes
- WorkOS User Management REST endpoints for sign-in, onboarding, MFA, and password recovery

The browser owns the UX. WorkOS secrets stay on the server side inside Convex.

## Included auth flows

- Email + password sign in
- Sign up with custom pages
- Email verification follow-up
- Organization selection follow-up
- TOTP MFA challenge during sign in
- TOTP MFA enrollment in the authenticated workspace
- Password reset request and confirmation pages

## Environment variables

Copy `.env.example` into your local env file and replace the placeholder values.

Required client variables:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

Required Convex server variables:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_CLIENT_SECRET` for password, refresh, MFA, and email verification exchanges
- `APP_ORIGIN` for CORS protection

Optional server variable:

- `WORKOS_ISSUER` if you want to pin verification to a specific issuer claim
- `WORKOS_JWKS_URL` if you need to override the default WorkOS JWKS path
- `WORKOS_API_SECRET` as a backward-compatible alias for `WORKOS_CLIENT_SECRET`

Set the server-side values in Convex before starting the backend, for example:

```bash
bunx convex env set WORKOS_API_KEY ...
bunx convex env set WORKOS_CLIENT_ID ...
bunx convex env set WORKOS_CLIENT_SECRET ...
bunx convex env set APP_ORIGIN http://localhost:5173
```

## Running locally

Install dependencies:

```bash
bun install
```

Start the Vite app:

```bash
bun run dev
```

Start Convex in a second terminal:

```bash
bun run convex:dev
```

## Key files

- `convex/http.ts` exposes custom auth endpoints like `/auth/sign-in`
- `convex/workos.ts` performs direct REST calls to WorkOS and verifies access tokens with `jose`
- `src/components/auth/auth-provider.tsx` manages client auth state, refreshes WorkOS sessions, and drives the custom auth flows

## Validation

```bash
bun run typecheck
bun run lint
bun run build
```
