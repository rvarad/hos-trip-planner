"""DRF serializers for the plan-trip request and response shapes."""

from rest_framework import serializers


class LocationSerializer(serializers.Serializer):
    """A geocoded point: a non-empty label plus valid coordinates."""

    label = serializers.CharField()
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class PlanTripRequestSerializer(serializers.Serializer):
    """The trip form's request: three resolved locations plus driver clock state.

    `cycle_hours_used` is in hours (converted to minutes at the view boundary);
    `start_time_minutes` is the minute-of-day the driver goes on duty.
    """

    current_location = LocationSerializer()
    pickup = LocationSerializer()
    dropoff = LocationSerializer()
    cycle_hours_used = serializers.FloatField(min_value=0, max_value=70)
    start_time_minutes = serializers.IntegerField(min_value=0, max_value=1439, default=0)


class HosClocksSerializer(serializers.Serializer):
    """Remaining-minutes HOS snapshot at a segment's end (engine `HosClocks`)."""

    drive_remaining_min = serializers.IntegerField()
    window_remaining_min = serializers.IntegerField()
    break_remaining_min = serializers.IntegerField()
    cycle_remaining_min = serializers.IntegerField()


class DutySegmentSerializer(serializers.Serializer):
    """One timeline segment from the engine's `DutySegment` dataclass."""

    start_min = serializers.IntegerField()
    end_min = serializers.IntegerField()
    status = serializers.CharField(source="status.value")
    description = serializers.CharField()
    start_location = LocationSerializer()
    end_location = LocationSerializer()
    miles = serializers.FloatField()
    clocks = HosClocksSerializer(required=False, allow_null=True)


class DayLogSerializer(serializers.Serializer):
    """One day of the timeline from the engine's `DayLog` dataclass."""

    date_offset = serializers.IntegerField()
    segments = DutySegmentSerializer(many=True)


class PlanResultSerializer(serializers.Serializer):
    """The engine's `PlanResult`: flat timeline, per-day logs, and total miles."""

    segments = DutySegmentSerializer(many=True)
    days = DayLogSerializer(many=True)
    total_miles = serializers.FloatField()


class PlanTripResponseSerializer(PlanResultSerializer):
    """The plan plus the trip-level routing source and the route polyline.

    `routing` is "osrm" or "estimated"; `route` is the full path as ordered
    [lng, lat] pairs (GeoJSON order), ready for MapLibre to draw.
    """

    routing = serializers.CharField()
    route = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    )
