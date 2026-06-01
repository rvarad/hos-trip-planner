# T5a: Geo stack setup (map foundation)

**Goal:** Stand up the frontend test runner and render a sleek dark MapLibre map.
Shared foundation for the pin-picker (T6a/T6b) and the result map (T10).

## Design (agreed 2026-06-01)

- **Integration:** **react-map-gl** (`react-map-gl/maplibre`) over **maplibre-gl**
  — declarative `<Map>`/`<Marker>`/`<Source>`/`<Layer>` with a `getMap()` escape
  hatch to the raw MapLibre instance when needed.
- **Style:** keyless **CARTO Dark Matter**
  (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`), swappable
  via `NEXT_PUBLIC_MAP_STYLE_URL`. Attribution: © OpenStreetMap, © CARTO.
- **Next.js:** the map is a client component (`"use client"`), dynamically
  imported with `ssr: false` (MapLibre needs `window`/WebGL); import
  `maplibre-gl/dist/maplibre-gl.css`.
- **Testing:** **Vitest + React Testing Library** (jsdom). WebGL can't run in
  jsdom, so map components are tested with **react-map-gl mocked** (assert the
  component renders) — the real visual check is `npm run build` + a browser. The
  test infra's real payoff is logic in T6b (debounce/resolution) and T6 (validation).
- **Theme:** a **dark-only** MUI theme (`palette.mode: "dark"` + an accent color)
  defined in `app/providers.tsx`, which already wraps the app in `ThemeProvider` +
  `CssBaseline`. The accent color is the single source of truth for the route line
  and marker colors (T6a/T10). A light/dark toggle is out of scope (revisit in T11).
- **Deps to add (approved):** prod `maplibre-gl`, `react-map-gl`; dev `vitest`,
  `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, `jsdom`.

## Subtasks

- [x] **T5a.1** Frontend test infra (Vitest + RTL)
  - Add the dev deps; `vitest.config.ts` (jsdom env, React plugin); a setup file
    wiring `@testing-library/jest-dom`; a `test` script in `package.json`. Add the
    test command to CLAUDE.md.
  - Test: a trivial smoke test (e.g. a tiny pure helper, or `render`-ing a static
    element) passes under `npm test`.

- [x] **T5a.2** `MapView` component (dark base map)
  - Add `maplibre-gl` + `react-map-gl`. Create a client component
    `app/components/MapView.tsx`: a `react-map-gl/maplibre` `<Map>` with the CARTO
    Dark Matter style (from `NEXT_PUBLIC_MAP_STYLE_URL`, with a default), an initial
    view over the continental U.S., pan/zoom + `NavigationControl`, CSS imported.
    (T6a later extends this with marker/pin props — same component.)
  - Test (react-map-gl mocked): the component renders its map container.

- [x] **T5a.3** Dark MUI theme
  - In `app/providers.tsx`, replace `createTheme()` with a dark theme
    (`palette.mode: "dark"` + an accent color used for the route/markers). The
    existing `CssBaseline` then applies the dark background/text app-wide.
  - Test: render a probe under `Providers` (or the theme) and assert the theme's
    `palette.mode === "dark"`.

- [x] **T5a.4** Render on the page
  - Mount `MapView` full-viewport on the home page (replacing the starter
    boilerplate), dynamically imported with `ssr: false`.
  - Verify: `npm run build` succeeds and the dark map renders/pans in a browser.
