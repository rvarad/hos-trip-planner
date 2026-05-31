from hos.engine import Location


def test_location_fields_accessible():
    loc = Location(label="Chicago, IL", lat=41.8781, lng=-87.6298)
    assert loc.label == "Chicago, IL"
    assert loc.lat == 41.8781
    assert loc.lng == -87.6298
