import urllib.error

from hos import routing
from hos.engine import Location

CURRENT = Location(label="A", lat=0.0, lng=0.0)
PICKUP = Location(label="B", lat=1.0, lng=0.0)
DROPOFF = Location(label="C", lat=1.0, lng=1.0)


def test_build_legs_connects_the_three_points():
    legs = routing.build_legs(CURRENT, PICKUP, DROPOFF)
    assert len(legs) == 2
    assert legs[0].start == CURRENT and legs[0].end == PICKUP
    assert legs[1].start == PICKUP and legs[1].end == DROPOFF


def test_haversine_distance_and_duration():
    legs = routing.build_legs(CURRENT, PICKUP, DROPOFF)
    leg = legs[0]
    # ~1 degree of latitude is ~69.1 miles.
    assert 68.5 < leg.distance_miles < 69.5
    assert leg.duration_minutes == round(leg.distance_miles / routing.AVG_SPEED_MPH * 60)


def test_leg_geometry_is_the_endpoints():
    legs = routing.build_legs(CURRENT, PICKUP, DROPOFF)
    assert legs[0].geometry == ((0.0, 0.0), (1.0, 0.0))


_OSRM_OK = {
    "code": "Ok",
    "routes": [
        {
            "distance": 1609.344,  # 1 mile in metres
            "duration": 120,  # 2 minutes in seconds
            "geometry": {"coordinates": [[-87.6298, 41.8781], [-90.1994, 38.6270]]},
        }
    ],
}


def test_osrm_leg_parses_distance_duration_geometry(monkeypatch):
    monkeypatch.setattr(routing, "_http_get_json", lambda url, **kw: _OSRM_OK)
    leg = routing._osrm_leg(CURRENT, PICKUP)
    assert leg.start == CURRENT and leg.end == PICKUP
    assert leg.distance_miles == 1.0
    assert leg.duration_minutes == 2
    # GeoJSON [lng, lat] is flipped to our (lat, lng).
    assert leg.geometry == ((41.8781, -87.6298), (38.6270, -90.1994))


def test_osrm_leg_returns_none_on_http_error(monkeypatch):
    def boom(url, **kw):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(routing, "_http_get_json", boom)
    assert routing._osrm_leg(CURRENT, PICKUP) is None


def test_osrm_leg_returns_none_when_no_route(monkeypatch):
    monkeypatch.setattr(routing, "_http_get_json", lambda url, **kw: {"code": "NoRoute", "routes": []})
    assert routing._osrm_leg(CURRENT, PICKUP) is None
