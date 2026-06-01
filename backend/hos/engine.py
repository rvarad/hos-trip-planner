"""HOS compliance engine.

Pure Python: no Django imports, no I/O, no clock reads. Deterministic.
Works in integer minutes-from-trip-start; clock formatting happens at the edges.
"""

from dataclasses import dataclass

from hos.rules import DROPOFF_MIN, PICKUP_MIN, DutyStatus


@dataclass(frozen=True)
class Location:
    """A geocoded point: a human-readable label plus its coordinates.

    Locations always carry coordinates because the frontend resolves every
    location to a point (geocoded text or a dropped map pin) before submit;
    the endpoint passes the coordinates to the routing API.
    """

    label: str
    lat: float
    lng: float


@dataclass(frozen=True)
class RouteLeg:
    """One driving stretch between two locations, as returned by routing (T5).

    The engine schedules against `distance_miles` and `duration_minutes`.
    `geometry` is a (lat, lng) polyline carried through for the map (T10); the
    engine never reads it.
    """

    start: Location
    end: Location
    distance_miles: float
    duration_minutes: int
    geometry: tuple[tuple[float, float], ...] = ()


@dataclass(frozen=True)
class TripInput:
    """The trip request: the ordered driving legs plus driver clock state.

    `current_cycle_used_minutes` seeds the 70hr/8day counter and is converted
    from the form's hours to minutes at the input boundary (serializer/view).
    `start_time_minutes` is the minute-of-day the driver goes on duty (the
    trip's time origin).
    """

    legs: list[RouteLeg]
    current_cycle_used_minutes: int
    start_time_minutes: int


@dataclass
class DriverState:
    """The engine's running accumulators as it walks the trip.

    Mutable by design (unlike the frozen value objects): the engine updates
    these in place against the limits in `rules.py`. The four clocks are integer
    minutes; `miles_since_fuel` is miles.
    """

    driving_since_break: int = 0   # min driven since last qualifying break (vs DRIVING_BEFORE_BREAK_MIN)
    driving_in_period: int = 0     # min driven this duty period (vs MAX_DRIVING_PER_PERIOD_MIN)
    elapsed_in_window: int = 0     # min since window start (vs MAX_DUTY_WINDOW_MIN)
    on_duty_in_cycle: int = 0      # on-duty min in the rolling cycle (vs MAX_CYCLE_ON_DUTY_MIN), seeded
    miles_since_fuel: float = 0.0  # miles since last fuel stop (vs FUEL_INTERVAL_MILES)


@dataclass(frozen=True)
class DutySegment:
    """One stretch of the timeline in a single duty status.

    `start_min`/`end_min` are integer minutes from trip start. `status` is a
    `DutyStatus`. Non-driving segments use `miles=0.0` and have
    `start_location == end_location`.
    """

    start_min: int
    end_min: int
    status: DutyStatus
    description: str
    start_location: Location
    end_location: Location
    miles: float


@dataclass(frozen=True)
class DayLog:
    """One calendar day of the timeline.

    `date_offset` is the number of days from trip start (0 = first day);
    `segments` are the duty-status stretches falling within that day.
    """

    date_offset: int
    segments: list[DutySegment]


@dataclass(frozen=True)
class PlanResult:
    """The engine's output.

    `segments` is the full flat timeline; `days` is the same timeline sliced
    into per-day logs; `total_miles` is the planned trip distance.
    """

    segments: list[DutySegment]
    days: list[DayLog]
    total_miles: float


def plan_trip(inp: TripInput) -> PlanResult:
    """Build an HOS-compliant timeline for the trip. Engine entry point.

    T3.1: walk the legs, emitting a driving segment per leg plus a 60-minute
    on-duty stop at pickup (after the first leg) and drop-off (after the last).
    HOS limits, fuel stops, and mid-leg interpolation arrive in later subtasks.
    """
    state = DriverState(on_duty_in_cycle=inp.current_cycle_used_minutes)
    segments: list[DutySegment] = []
    clock = 0
    total_miles = 0.0
    last = len(inp.legs) - 1

    for i, leg in enumerate(inp.legs):
        segments.append(
            DutySegment(
                start_min=clock,
                end_min=clock + leg.duration_minutes,
                status=DutyStatus.DRIVING,
                description=f"Drive to {leg.end.label}",
                start_location=leg.start,
                end_location=leg.end,
                miles=leg.distance_miles,
            )
        )
        clock += leg.duration_minutes
        total_miles += leg.distance_miles

        if i == 0:
            clock = _append_on_duty_stop(segments, clock, leg.end, "Pickup", PICKUP_MIN)
        if i == last:
            clock = _append_on_duty_stop(segments, clock, leg.end, "Drop-off", DROPOFF_MIN)

    return PlanResult(segments=segments, days=[], total_miles=total_miles)


def _append_on_duty_stop(
    segments: list[DutySegment],
    clock: int,
    where: Location,
    description: str,
    minutes: int,
) -> int:
    """Append an on-duty-not-driving stop of `minutes`; return the advanced clock."""
    segments.append(
        DutySegment(
            start_min=clock,
            end_min=clock + minutes,
            status=DutyStatus.ON_DUTY_NOT_DRIVING,
            description=description,
            start_location=where,
            end_location=where,
            miles=0.0,
        )
    )
    return clock + minutes
