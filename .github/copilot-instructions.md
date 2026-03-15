# Copilot instructions for `cc-video-tool`

## Build, lint, and test commands

- This repo uses Bun (`bun.lock` is committed). Install dependencies with `bun install`.
- Start the Vite dev server with `bun run dev`.
- Run a production build with `bun run build`.
- Run TypeScript checks with `bun run typecheck`.
- Run ESLint with `bun run lint`.
- Format TypeScript and TSX files with `bun run format`.
- There is currently no automated test setup in this repository: `package.json` has no `test` script and there are no `*.test.*` or `*.spec.*` files, so there is no single-test command yet.

## High-level architecture

- This is a small client-side React 19 + Vite 7 + TypeScript app. The app boots from `src/main.tsx`, which renders `RouterProvider` inside `ThemeProvider`.
- Routing is configured manually in `src/router.tsx` with TanStack Router rather than file-generated routes. The router currently defines:
  - a root layout route rendered by `src/routes/root-layout.tsx`,
  - an index route that renders `src/App.tsx`,
  - an `/about` route rendered by `src/routes/about-page.tsx`,
  - shared not-found and error UI in `src/routes/not-found-page.tsx` and `src/components/router/default-catch-boundary.tsx`.
- The current render tree is: `src/main.tsx` -> `ThemeProvider` -> `RouterProvider` -> root layout route -> page route component.
- `src/components/theme-provider.tsx` is the main cross-cutting runtime piece. It:
  - stores the selected theme in `localStorage` under the `theme` key,
  - resolves `"system"` using `prefers-color-scheme`,
  - applies `light`/`dark` classes to `document.documentElement`,
  - syncs theme changes across tabs via the `storage` event,
  - toggles dark mode when the user presses `d` outside editable fields.
- `src/router.tsx` also sets the current router-wide defaults: `defaultPreload: "intent"`, `defaultPreloadDelay: 50`, `scrollRestoration: true`, and global error/not-found components. It also registers the router type for TanStack Router hook inference.
- Styling is centralized in `src/index.css`. Tailwind v4 is loaded via CSS `@import`, and the design tokens are defined as CSS custom properties and mapped into Tailwind with `@theme inline`.
- `src/App.tsx` is still a starter screen, which means most product behavior has not been split into feature folders yet. When adding substantial UI, future sessions will likely need to establish the first real feature-level composition patterns instead of following an existing module hierarchy.
- UI primitives live in `src/components/ui`. The current `Button` is representative: it wraps a Base UI primitive, reads its shared styles from `src/components/ui/button-variants.ts`, and merges classes with the shared `cn()` helper from `src/lib/utils.ts`.
- The visual system flows from `src/index.css` theme tokens into Tailwind utility classes in components. If a style change should affect the whole app, check `index.css` first before patching individual component class strings.

## Key repository conventions

- Use the `@` alias for app imports. It resolves to `src` in both Vite (`vite.config.ts`) and TypeScript (`tsconfig.app.json`).
- This project was scaffolded with shadcn/ui and keeps shadcn aliases in `components.json`. Add new UI components with `npx shadcn@latest add <component>` and place generated primitives under `src/components/ui`.
- Keep styling aligned with the existing Tailwind/shadcn pattern:
  - use semantic theme tokens like `bg-background`, `text-foreground`, `border-border`,
  - compose utility classes with `cn(...)`,
  - define component variants with `cva(...)` when a component has variant/size props.
- Route navigation should use TanStack Router primitives (`Link`, route definitions, router defaults) rather than ad hoc anchors or conditional rendering in `main.tsx`.
- Preserve the current formatting conventions from `.prettierrc`: no semicolons, double quotes, 80-character print width, and Tailwind class sorting through `prettier-plugin-tailwindcss` (including class strings inside `cn()` and `cva()`).
- TypeScript is configured in strict bundler mode. `allowImportingTsExtensions` is enabled, so existing imports such as `./App.tsx` and `@/components/theme-provider.tsx` are intentional and do not need to be normalized away.
- Be careful with exports in component files: ESLint includes the Vite Fast Refresh rule, so shared non-component helpers should live in separate modules like `src/components/ui/button-variants.ts` instead of component files.
