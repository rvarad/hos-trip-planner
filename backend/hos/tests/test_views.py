import urllib.error

import pytest
from rest_framework.test import APIClient

from hos import routing


@pytest.fixture(autouse=True)
def _offline_routing(monkeypatch):
    """Keep view tests offline: force the haversine fallback (no OSRM network)."""

    def boom(url, **kw):
        raise urllib.error.URLError("offline in tests")

    monkeypatch.setattr(routing, "_http_get_json", boom)


def _loc(label, lat, lng):
    return {"label": label, "lat": lat, "lng": lng}


def _trip_payload(**overrides):
    payload = {
        "current_location": _loc("Chicago, IL", 41.8781, -87.6298),
        "pickup": _loc("St. Louis, MO", 38.6270, -90.1994),
        "dropoff": _loc("Dallas, TX", 32.7767, -96.7970),
        "cycle_hours_used": 10.0,
        "start_time_minutes": 480,
    }
    payload.update(overrides)
    return payload


def test_post_plan_trip_returns_timeline():
    resp = APIClient().post("/api/plan-trip", _trip_payload(), format="json")
    assert resp.status_code == 200, resp.data
    assert "total_miles" in resp.data
    assert resp.data["segments"][0]["status"] == "driving"
    assert resp.data["routing"] == "estimated"  # OSRM mocked offline -> fallback


def test_post_plan_trip_rejects_invalid():
    resp = APIClient().post("/api/plan-trip", _trip_payload(cycle_hours_used=99.0), format="json")
    assert resp.status_code == 400


def test_response_includes_route_geometry():
    """T10.1: the response carries the route polyline as [lng, lat] pairs,
    running from the current location to the drop-off."""
    payload = _trip_payload()
    resp = APIClient().post("/api/plan-trip", payload, format="json")
    assert resp.status_code == 200, resp.data
    route = resp.data["route"]
    assert isinstance(route, list) and len(route) >= 2
    for point in route:
        lng, lat = point
        assert -180 <= lng <= 180 and -90 <= lat <= 90
    # Fallback geometry is a straight line per leg, in [lng, lat] order.
    assert route[0] == [payload["current_location"]["lng"], payload["current_location"]["lat"]]
    assert route[-1] == [payload["dropoff"]["lng"], payload["dropoff"]["lat"]]


def test_route_uses_osrm_geometry(monkeypatch):
    """T10.1: OSRM's road geometry flows through to `route` in [lng, lat] order."""
    fake = {
        "code": "Ok",
        "routes": [
            {
                "distance": 1609.344,  # 1 mile
                "duration": 600,  # 10 min
                "geometry": {
                    "coordinates": [[-87.6298, 41.8781], [-90.0, 40.0], [-96.7970, 32.7767]]
                },
            }
        ],
    }
    monkeypatch.setattr(routing, "_http_get_json", lambda url, **kw: fake)
    resp = APIClient().post("/api/plan-trip", _trip_payload(), format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["routing"] == "osrm"
    assert [-90.0, 40.0] in resp.data["route"]
