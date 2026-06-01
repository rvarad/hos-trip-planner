"""Turn trip locations into the engine's route legs.

Interim implementation (T4): straight-line haversine distance plus an assumed
average speed, with a two-point geometry. T5 replaces the internals with OSRM
(real road distance + route geometry); `build_legs`'s signature stays the same.
"""

import json
import math
import os
import urllib.error
import urllib.request

from hos.engine import Location, RouteLeg

AVG_SPEED_MPH = 55
_EARTH_RADIUS_MILES = 3958.8

OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
_METERS_PER_MILE = 1609.344
_HTTP_TIMEOUT_SECONDS = 10


def _http_get_json(url: str, timeout: float = _HTTP_TIMEOUT_SECONDS) -> dict:
    """GET a URL and parse the JSON body. The seam mocked in tests."""
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _osrm_leg(start: Location, end: Location) -> RouteLeg | None:
    """Route one leg via OSRM. Returns None on any failure (caller falls back)."""
    url = (
        f"{OSRM_URL}/route/v1/driving/"
        f"{start.lng},{start.lat};{end.lng},{end.lat}"
        "?overview=full&geometries=geojson"
    )
    try:
        data = _http_get_json(url)
        if data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        coordinates = route["geometry"]["coordinates"]
        return RouteLeg(
            start=start,
            end=end,
            distance_miles=route["distance"] / _METERS_PER_MILE,
            duration_minutes=round(route["duration"] / 60),
            geometry=tuple((lat, lng) for lng, lat in coordinates),
        )
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError):
        return None


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
) -> tuple[list[RouteLeg], str]:
    """Two driving legs (current → pickup → drop-off) plus the routing source.

    Each leg is routed via OSRM; if a leg fails it falls back to a straight-line
    haversine estimate. The source is "osrm" when every leg routed, else
    "estimated".
    """
    legs: list[RouteLeg] = []
    source = "osrm"
    for start, end in ((current, pickup), (pickup, dropoff)):
        leg = _osrm_leg(start, end)
        if leg is None:
            leg = _leg(start, end)
            source = "estimated"
        legs.append(leg)
    return legs, source
