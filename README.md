# Dinik Diary

A personal daily-life tracker: habits in phases, activities by category, and weekly/monthly reports.

- What the app does, page by page: [APP-GUIDE.md](APP-GUIDE.md)
- Product plan: [plan.md](plan.md)
- Build phases: [build-plan.md](build-plan.md)

## Requirements

- Node.js 20.9 or newer
- npm

## Getting started

```bash
npm install
npx playwright install chromium   # once, for end-to-end tests
npm run dev                       # http://localhost:3000
```

## Scripts

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start the dev server                                  |
| `npm run build`        | Production build                                      |
| `npm start`            | Run the production build                              |
| `npm run lint`         | ESLint                                                |
| `npm run format`       | Format all files with Prettier                        |
| `npm run format:check` | Check formatting without changing files               |
| `npm run typecheck`    | Generate Next.js route types, then run TypeScript     |
| `npm test`             | Unit tests (Vitest), once                             |
| `npm run test:watch`   | Unit tests in watch mode                              |
| `npm run e2e`          | Build, then end-to-end tests on port 3100 (laptop + phone size) |
| `npm run e2e:only`     | End-to-end tests without rebuilding                   |
| `npm run check`        | lint + format check + typecheck + unit tests together |

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Vitest · Playwright

## Project layout

```
src/app/(app)/    screens inside the app shell (Today, Activities, Reports, ...)
src/brand/        brand config + fonts
src/theme/        colour tokens, theme presets, theme switching
src/copy/         all user-facing text
src/components/   shared components (ui/ = shadcn, app-shell/ = sidebar + tab bar + nav list)
src/features/     screen-specific pieces
src/stores/       Zustand UI state
src/lib/          helpers and, later, core logic
tests/e2e/        Playwright tests
```

To add a screen: create `src/app/(app)/<name>/page.tsx`, add it to `NAV_ITEMS` in
`src/components/app-shell/nav.ts`, and add its text to `src/copy/en.ts`.

Unit tests live next to the code as `*.test.ts(x)`.
