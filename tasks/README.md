# Task Index

| ID  | Title                                      | Status      |
| --- | ------------------------------------------ | ----------- |
| T1  | Foundation skeleton                        | done        |
| T2  | HOS engine data shapes + function skeleton | done        |
| T3  | HOS engine logic + tests                   | done        |
| T4  | DRF POST /api/plan-trip                    | done        |
| T5  | Geo provider stack + routing integration   | done        |
| T5a | Geo stack setup (map foundation)           | done        |
| T6  | Next.js MUI input form                     | done        |
| T6a | Reusable `<MapView>` component             | done        |
| T6b | `<LocationField>` (search or drop a pin)   | done        |
| T7  | Next.js server-side proxy routes           | done        |
| T8  | Log-sheet SVG rendering                    | done        |
| T9  | Multi-day log slicing at midnight          | done        |
| T10 | Map display with route + markers           | done        |
| T11 | Polish                                     | in progress |
| T12 | Deploy                                     | in progress |
| T13 | Loom recording                             | not started |
| T14 | Log the 10-hour rest as sleeper berth      | done        |

**Suggested order for the location feature:** T2.0/T2.1 + T4 (data shape) →
T5/T5a (geo stack + map) → T6a (`<MapView>`) → T7 (geocode proxies) → T6b
(`<LocationField>`) → T6 (form) → T10 (result map).
