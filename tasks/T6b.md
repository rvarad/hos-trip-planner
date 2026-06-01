# T6b: `<LocationField>` component (search or drop a pin)

**Goal:** The Uber/Ola-style location picker. The user types to get autocomplete
suggestions OR opens a map and drops/drags a pin. Either way the field resolves to
a `ResolvedLocation` (`{ label, lat, lng }`). Uses the geocode/reverse proxies (T7)
and `<MapView>` (T6a).

## Design (agreed 2026-06-01)

- **Controlled component:** props `value: ResolvedLocation | null`, `onChange`,
  `label` (e.g. "Pickup"), optional `mapCenter` for proximity bias. The parent
  (T6 form) owns each value.
- **Geocoding client (`app/lib/geocoding.ts`):** `searchLocations(q, center?)` →
  `GET /api/geocode`, `reverseGeocode(lat, lng)` → `GET /api/reverse`. Home of the
  shared `ResolvedLocation` type. Testable via mocked `fetch`.
- **Search:** MUI `<Autocomplete>` (not free-solo — must pick a resolved option);
  options from a **debounced (~250ms)** `searchLocations`, stale responses ignored;
  a loading spinner while a query is in flight; selecting an option calls `onChange`.
- **Pin mode:** an icon button opens a MUI `<Dialog>` with `<MapView>` in pick mode
  (`onPinPlaced`); a placed/dragged pin calls `reverseGeocode` and resolves the
  field (label + the pin's own coords), then closes.
- **Use my location:** a button → `navigator.geolocation` → `reverseGeocode` →
  `onChange`.
- **Out of scope (→ T11):** a recent-locations list (needs localStorage + dedup).
- **Testing:** mock `fetch`; `vi.mock` the `MapView` module (WebGL) so the dialog
  can fire `onPinPlaced`; fake timers for the debounce.

## Subtasks

- [x] **T6b.1** Geocoding client + autocomplete search
  - Add `app/lib/geocoding.ts` (`ResolvedLocation`, `searchLocations`,
    `reverseGeocode`). Build `<LocationField>` with a debounced MUI `<Autocomplete>`
    that lists results and resolves the field on select; show a loading spinner.
  - Test: typing triggers one debounced `GET /api/geocode` (fake timers); selecting
    a suggestion calls `onChange` with `{ label, lat, lng }`.

- [ ] **T6b.2** Drop-a-pin mode
  - A "drop a pin" button opens a `<Dialog>` with `<MapView>` in pick mode; a
    placed pin calls `reverseGeocode` and resolves the field, then closes.
  - Test (MapView mocked): firing `onPinPlaced` calls `GET /api/reverse` and then
    `onChange` with the resolved location (pin coords + label).

- [ ] **T6b.3** Use my current location
  - A button reads `navigator.geolocation.getCurrentPosition`, reverse-geocodes the
    coords, and resolves the field.
  - Test (geolocation + fetch mocked): the resolved location is set via `onChange`.
