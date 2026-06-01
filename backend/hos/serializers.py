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
