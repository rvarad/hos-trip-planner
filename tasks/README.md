# Task Index

| ID  | Title                                       | Status      |
|-----|---------------------------------------------|-------------|
| T1  | Foundation skeleton                         | done        |
| T2  | HOS engine data shapes + function skeleton  | done        |
| T3  | HOS engine logic + tests                    | done        |
| T4  | DRF POST /api/plan-trip                     | done        |
| T5  | Geo provider stack + routing integration    | not started |
| T5a | Geo stack setup (map foundation)            | not started |
| T6  | Next.js MUI input form                      | not started |
| T6a | Reusable `<MapView>` component              | not started |
| T6b | `<LocationField>` (search or drop a pin)    | not started |
| T7  | Next.js server-side proxy routes            | not started |
| T8  | Log-sheet SVG rendering                     | not started |
| T9  | Multi-day log slicing at midnight           | not started |
| T10 | Map display with markers                    | not started |
| T11 | Polish                                      | not started |
| T12 | Deploy                                      | not started |
| T13 | Loom recording                             | not started |

**Suggested order for the location feature:** T2.0/T2.1 + T4 (data shape) →
T5/T5a (geo stack + map) → T6a (`<MapView>`) → T7 (geocode proxies) → T6b
(`<LocationField>`) → T6 (form) → T10 (result map).
