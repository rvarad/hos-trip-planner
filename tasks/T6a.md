# T6a: Reusable `<MapView>` component

**Goal:** Evolve the T5a `MapView` into a reusable, parameterized component shared
by the location picker (T6b) and the result display (T10): render markers, support
a draggable pin-drop, and frame the view.

## Design (agreed 2026-06-01)

- **Backward compatible:** all new props are optional, so the bare `<MapView />`
  (home page) still renders the dark base map unchanged.
- **Marker type:** `MapMarker = { lat: number; lng: number; kind: string; label?: string }`.
  Rendered via react-map-gl `<Marker>`; colored by `kind` with the theme accent as
  default. The full semantic palette (pickup/dropoff/fuel/rest) is fleshed out in T10.
- **Controlled pin:** the parent owns the picked point — `pin?: { lat, lng } | null`
  plus `onPinPlaced?(lat, lng)`. When `onPinPlaced` is set, the map is in "pick
  mode": clicking the map and dragging the pin both report the new coordinate. T6b
  wires this to form state.
- **Camera:** `fitToMarkers?: boolean` (default on when markers are present) frames
  all markers via the map ref's `fitBounds`; otherwise the existing US-centered
  default view is used.
- **Testing:** extend the react-map-gl mock to render each `<Marker>` as an element
  (assert count) and to forward `onClick`/`onDragEnd` so pin-drop and drag can be
  simulated in jsdom.

## Subtasks

- [x] **T6a.1** Markers + camera framing
  - Add the optional `markers` prop and a `MapMarker` type; render one marker per
    entry (kind-based color, accent default). Add `fitToMarkers` framing via the
    map ref (`fitBounds`), falling back to the default view.
  - Test (react-map-gl mocked): rendering with N markers shows N marker elements;
    bare `<MapView />` still renders the map.

- [x] **T6a.2** Pin-drop / draggable pin
  - Add `pin` + `onPinPlaced`. In pick mode, a map click fires `onPinPlaced(lat,
    lng)`; the placed `pin` renders as a draggable marker whose `onDragEnd` also
    fires `onPinPlaced`.
  - Test (mocked): simulating a map click invokes `onPinPlaced` with coordinates;
    simulating a pin drag invokes it with the dragged coordinates.
