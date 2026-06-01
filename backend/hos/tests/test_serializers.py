from hos.engine import DayLog, DutySegment, Location, PlanResult
from hos.rules import DutyStatus
from hos.serializers import (
    LocationSerializer,
    PlanResultSerializer,
    PlanTripRequestSerializer,
)


def _loc(label):
    return {"label": label, "lat": 40.0, "lng": -90.0}


def _trip_payload(**overrides):
    payload = {
        "current_location": _loc("Chicago, IL"),
        "pickup": _loc("St. Louis, MO"),
        "dropoff": _loc("Dallas, TX"),
        "cycle_hours_used": 12.5,
        "start_time_minutes": 480,
    }
    payload.update(overrides)
    return payload


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


def test_valid_trip_request():
    s = PlanTripRequestSerializer(data=_trip_payload())
    assert s.is_valid(), s.errors
    assert s.validated_data["pickup"]["label"] == "St. Louis, MO"
    assert s.validated_data["cycle_hours_used"] == 12.5
    assert s.validated_data["start_time_minutes"] == 480


def test_start_time_minutes_defaults_to_zero():
    payload = _trip_payload()
    del payload["start_time_minutes"]
    s = PlanTripRequestSerializer(data=payload)
    assert s.is_valid(), s.errors
    assert s.validated_data["start_time_minutes"] == 0


def test_missing_location_rejected():
    payload = _trip_payload()
    del payload["pickup"]
    s = PlanTripRequestSerializer(data=payload)
    assert not s.is_valid()
    assert "pickup" in s.errors


def test_cycle_hours_out_of_range_rejected():
    s = PlanTripRequestSerializer(data=_trip_payload(cycle_hours_used=71.0))
    assert not s.is_valid()
    assert "cycle_hours_used" in s.errors


def test_plan_result_serialization():
    loc_a = Location(label="A", lat=1.0, lng=2.0)
    loc_b = Location(label="B", lat=3.0, lng=4.0)
    seg = DutySegment(
        start_min=0,
        end_min=120,
        status=DutyStatus.DRIVING,
        description="Drive to B",
        start_location=loc_a,
        end_location=loc_b,
        miles=50.0,
    )
    result = PlanResult(segments=[seg], days=[DayLog(date_offset=0, segments=[seg])], total_miles=50.0)

    data = PlanResultSerializer(result).data
    assert data["total_miles"] == 50.0
    assert data["segments"][0]["status"] == "driving"
    assert data["segments"][0]["end_min"] == 120
    assert data["segments"][0]["start_location"] == {"label": "A", "lat": 1.0, "lng": 2.0}
    assert data["days"][0]["segments"][0]["status"] == "driving"
