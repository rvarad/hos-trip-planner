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
