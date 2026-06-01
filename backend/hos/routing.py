"""Turn trip locations into the engine's route legs.

Interim implementation (T4): straight-line haversine distance plus an assumed
average speed, with a two-point geometry. T5 replaces the internals with OSRM
(real road distance + route geometry); `build_legs`'s signature stays the same.
"""

import math

from hos.engine import Location, RouteLeg

AVG_SPEED_MPH = 55
_EARTH_RADIUS_MILES = 3958.8


def _haversine_miles(a: Location, b: Location) -> float:
    """Great-circle distance between two points, in miles."""
    lat1, lng1, lat2, lng2 = map(math.radians, (a.lat, a.lng, b.lat, b.lng))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def _leg(start: Location, end: Location) -> RouteLeg:
    distance = _haversine_miles(start, end)
    return RouteLeg(
        start=start,
        end=end,
        distance_miles=distance,
        duration_minutes=round(distance / AVG_SPEED_MPH * 60),
        geometry=((start.lat, start.lng), (end.lat, end.lng)),
    )


def build_legs(
    current: Location, pickup: Location, dropoff: Location
) -> list[RouteLeg]:
    """Two driving legs: current → pickup, then pickup → drop-off."""
    return [_leg(current, pickup), _leg(pickup, dropoff)]
