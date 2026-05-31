from hos.engine import Location, TripInput


def test_location_fields_accessible():
    loc = Location(label="Chicago, IL", lat=41.8781, lng=-87.6298)
    assert loc.label == "Chicago, IL"
    assert loc.lat == 41.8781
    assert loc.lng == -87.6298


def test_trip_input_fields_accessible():
    current = Location(label="Chicago, IL", lat=41.8781, lng=-87.6298)
    pickup = Location(label="St. Louis, MO", lat=38.6270, lng=-90.1994)
    dropoff = Location(label="Dallas, TX", lat=32.7767, lng=-96.7970)
    trip = TripInput(
        current_location=current,
        pickup=pickup,
        dropoff=dropoff,
        cycle_hours_used=12.5,
        start_time_minutes=480,
    )
    assert trip.current_location.label == "Chicago, IL"
    assert trip.pickup.lat == 38.6270
    assert trip.dropoff.lng == -96.7970
    assert trip.cycle_hours_used == 12.5
    assert trip.start_time_minutes == 480
