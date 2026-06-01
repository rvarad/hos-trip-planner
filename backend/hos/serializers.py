"""DRF serializers for the plan-trip request and response shapes."""

from rest_framework import serializers


class LocationSerializer(serializers.Serializer):
    """A geocoded point: a non-empty label plus valid coordinates."""

    label = serializers.CharField()
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
