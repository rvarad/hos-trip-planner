# T5a: Geo stack setup (map foundation)

**Goal:** Install MapLibre GL JS and render a basic interactive map with free
vector tiles. This is the shared foundation for the pin-picker (T6a/T6b) and the
result map (T10). Depends on the stack chosen in T5.

## Subtasks

- [ ] **T5a.1** Add MapLibre GL JS to the frontend
  - Install the dependency (ask first per protocol); configure a free vector
    tile style (e.g. OpenFreeMap). No API key required.
  - Test: a smoke test / Storybook-style page mounts the map without errors.

- [ ] **T5a.2** Render a basic interactive map
  - A page or component mounts a pan/zoom map centered on the continental U.S.
  - Test: component renders; map container is present in the DOM.
