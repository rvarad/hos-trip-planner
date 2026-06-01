"""DRF endpoints. Thin — delegate to `routing` and `engine`."""

from types import SimpleNamespace

from rest_framework.response import Response
from rest_framework.views import APIView

from hos import routing
from hos.engine import Location, TripInput, plan_trip
from hos.serializers import PlanTripRequestSerializer, PlanTripResponseSerializer


class PlanTripView(APIView):
    """POST a trip (three locations + cycle hours + start time) → HOS timeline."""

    def post(self, request):
        req = PlanTripRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        d = req.validated_data
        legs, routing_source = routing.build_legs(
            Location(**d["current_location"]),
            Location(**d["pickup"]),
            Location(**d["dropoff"]),
        )
        trip = TripInput(
            legs=legs,
            current_cycle_used_minutes=round(d["cycle_hours_used"] * 60),
            start_time_minutes=d["start_time_minutes"],
        )
        result = plan_trip(trip)
        payload = SimpleNamespace(
            routing=routing_source,
            segments=result.segments,
            days=result.days,
            total_miles=result.total_miles,
        )
        return Response(PlanTripResponseSerializer(payload).data)
