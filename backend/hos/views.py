"""DRF endpoints. Thin — delegate to `routing` and `engine`."""

from rest_framework.response import Response
from rest_framework.views import APIView

from hos import routing
from hos.engine import Location, TripInput, plan_trip
from hos.serializers import PlanResultSerializer, PlanTripRequestSerializer


class PlanTripView(APIView):
    """POST a trip (three locations + cycle hours + start time) → HOS timeline."""

    def post(self, request):
        req = PlanTripRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        d = req.validated_data
        legs = routing.build_legs(
            Location(**d["current_location"]),
            Location(**d["pickup"]),
            Location(**d["dropoff"]),
        )
        trip = TripInput(
            legs=legs,
            current_cycle_used_minutes=round(d["cycle_hours_used"] * 60),
            start_time_minutes=d["start_time_minutes"],
        )
        return Response(PlanResultSerializer(plan_trip(trip)).data)
