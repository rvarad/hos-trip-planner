# T6b: `<LocationField>` component (search or drop a pin)

**Goal:** The Uber/Ola-style location picker. The user either types to get
autocomplete suggestions OR switches to map mode and drops/drags a pin. Either
way the field resolves to `{ label, lat, lng }`. Uses the geocode proxy (T7) and
`<MapView>` (T6a).

## Subtasks

- [ ] **T6b.1** Autocomplete search
  - MUI Autocomplete; debounced (~250ms) calls to `/api/geocode` (T7) with
    proximity bias toward the current map center.
  - Keyboard navigation of results; selecting a result resolves the field.
  - Test: typing triggers a debounced fetch; selecting a suggestion sets
    `{ label, lat, lng }`.

- [ ] **T6b.2** Drop-a-pin mode
  - Toggle to open `<MapView>` (T6a) in pick mode; dropping/dragging the pin calls
    `/api/reverse` (T7) to fill the label.
  - Test: a pin-placed event resolves the field with a reverse-geocoded label.

- [ ] **T6b.3** UX polish
  - Loading skeleton on suggestions, recent-locations list, and a "use my current
    location" action (browser geolocation → reverse geocode).
  - Test: loading state renders while a query is in flight.
