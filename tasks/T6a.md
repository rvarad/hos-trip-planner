# T6a: Reusable `<MapView>` component

**Goal:** A single reusable MapLibre GL map component shared by the location
picker (T6b) and the result display (T10). Built on the T5a foundation.

## Subtasks

- [ ] **T6a.1** Markers & camera
  - Props for an array of markers (`{ lat, lng, kind }`) and a fit-to-bounds /
    center API.
  - Test: rendering with markers places the expected number of marker elements.

- [ ] **T6a.2** Pin-drop / draggable pin
  - Optional "pick mode": clicking the map (and dragging the pin) fires
    `onPinPlaced(lat, lng)`. Used by T6b for the drop-a-pin flow.
  - Test: simulating a map click invokes `onPinPlaced` with coordinates.
