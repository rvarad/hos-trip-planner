from hos.serializers import LocationSerializer


def test_valid_location():
    s = LocationSerializer(data={"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298})
    assert s.is_valid(), s.errors
    assert s.validated_data["label"] == "Chicago, IL"
    assert s.validated_data["lat"] == 41.8781
    assert s.validated_data["lng"] == -87.6298


def test_empty_label_rejected():
    s = LocationSerializer(data={"label": "", "lat": 41.0, "lng": -87.0})
    assert not s.is_valid()
    assert "label" in s.errors


def test_latitude_out_of_range_rejected():
    s = LocationSerializer(data={"label": "X", "lat": 91.0, "lng": -87.0})
    assert not s.is_valid()
    assert "lat" in s.errors


def test_longitude_out_of_range_rejected():
    s = LocationSerializer(data={"label": "X", "lat": 41.0, "lng": -181.0})
    assert not s.is_valid()
    assert "lng" in s.errors
