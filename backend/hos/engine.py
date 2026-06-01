"""HOS compliance engine.

Pure Python: no Django imports, no I/O, no clock reads. Deterministic.
Works in integer minutes-from-trip-start; clock formatting happens at the edges.
"""

from dataclasses import dataclass

from hos.rules import (
    CYCLE_DAYS,
    DRIVING_BEFORE_BREAK_MIN,
    DROPOFF_MIN,
    FUEL_INTERVAL_MILES,
    FUEL_STOP_MIN,
    MAX_CYCLE_ON_DUTY_MIN,
    MAX_DRIVING_PER_PERIOD_MIN,
    MAX_DUTY_WINDOW_MIN,
    MIN_BREAK_MIN,
    MIN_RESET_OFF_DUTY_MIN,
    PICKUP_MIN,
    RESTART_OFF_DUTY_MIN,
    DutyStatus,
)


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


def slice_days(
    segments: list[DutySegment], start_time_minutes: int
) -> list[DayLog]:
    """Slice the flat timeline into per-calendar-day logs, splitting at midnight.

    Segment times are minutes-from-trip-start; `start_time_minutes` anchors them to
    the wall clock. Each returned `DutySegment` carries day-local minute-of-day
    times (0–1440) with miles apportioned by the piece's duration; segments crossing
    a midnight are split across days. Ordered by `date_offset` (0 = first day).
    """
    by_day: dict[int, list[DutySegment]] = {}
    for seg in segments:
        seg_duration = seg.end_min - seg.start_min
        if seg_duration <= 0:
            continue
        absolute_start = start_time_minutes + seg.start_min
        absolute_end = start_time_minutes + seg.end_min
        cursor = absolute_start
        day = cursor // 1440
        while cursor < absolute_end:
            day_start = day * 1440
            piece_end = min(absolute_end, day_start + 1440)
            by_day.setdefault(day, []).append(
                DutySegment(
                    start_min=cursor - day_start,
                    end_min=piece_end - day_start,
                    status=seg.status,
                    description=seg.description,
                    start_location=seg.start_location,
                    end_location=seg.end_location,
                    miles=seg.miles * (piece_end - cursor) / seg_duration,
                )
            )
            cursor = piece_end
            day += 1

    return [DayLog(date_offset=d, segments=by_day[d]) for d in sorted(by_day)]


def plan_trip(inp: TripInput) -> PlanResult:
    """Build an HOS-compliant timeline for the trip. Engine entry point.

    T3.1: walk the legs, emitting a driving segment per leg plus a 60-minute
    on-duty stop at pickup (after the first leg) and drop-off (after the last).
    T3.2: split driving and insert a 10-hour reset when the 11h driving limit or
    14h window is reached. Fuel stops, the 30-min break, the cycle cap, and
    mid-leg interpolation arrive in later subtasks.
    """
    state = DriverState(on_duty_in_cycle=inp.current_cycle_used_minutes)
    segments: list[DutySegment] = []
    clock = 0
    total_miles = 0.0
    last = len(inp.legs) - 1

    for i, leg in enumerate(inp.legs):
        clock = _drive_leg(leg, state, segments, clock)
        total_miles += leg.distance_miles

        if i == 0:
            clock = _append_on_duty_stop(segments, clock, state, leg.end, "Pickup", PICKUP_MIN)
        if i == last:
            clock = _append_on_duty_stop(segments, clock, state, leg.end, "Drop-off", DROPOFF_MIN)

    return PlanResult(segments=segments, days=[], total_miles=total_miles)


def rolling_cycle_minutes(
    daily_on_duty_minutes: list[int], day_index: int, cycle_days: int = CYCLE_DAYS
) -> int:
    """On-duty minutes over the rolling cycle window ending at `day_index`.

    Implements the § 395.3(b) rolling 70-hour/8-day total: the sum of on-duty
    time over the current day and the preceding `cycle_days - 1` days, with older
    days dropping off. `day_index` is 0-based into `daily_on_duty_minutes`.

    Standalone and validated against the FMCSA guide's worked table (T3.7). It is
    the canonical building block for multi-day cycle accounting; `plan_trip`
    enforces the cap via the seeded `on_duty_in_cycle` accumulator and 34-hour
    restart, since a single planned trip is short enough that days don't roll off.
    """
    start = max(0, day_index - cycle_days + 1)
    return sum(daily_on_duty_minutes[start : day_index + 1])


def _point_in_leg(leg: RouteLeg, minutes_done: int) -> Location:
    """The location reached after driving `minutes_done` of a leg.

    Endpoints keep their real labels; intermediate points are linearly
    interpolated and labelled by distance from the leg's start.
    """
    if minutes_done <= 0:
        return leg.start
    if minutes_done >= leg.duration_minutes:
        return leg.end
    fraction = minutes_done / leg.duration_minutes
    return Location(
        label=f"En route (~{round(leg.distance_miles * fraction)} mi from {leg.start.label})",
        lat=leg.start.lat + (leg.end.lat - leg.start.lat) * fraction,
        lng=leg.start.lng + (leg.end.lng - leg.start.lng) * fraction,
    )


def _drive_leg(
    leg: RouteLeg, state: DriverState, segments: list[DutySegment], clock: int
) -> int:
    """Spend a leg's driving time, splitting for the 11h/14h limits.

    Emits one or more DRIVING segments; inserts a 10-hour reset whenever the
    driving-per-period or duty-window cap is reached. Returns the advanced clock.
    """
    remaining = leg.duration_minutes
    speed = leg.distance_miles / leg.duration_minutes if leg.duration_minutes else 0.0
    while remaining > 0:
        minutes_to_fuel = (
            (FUEL_INTERVAL_MILES - state.miles_since_fuel) / speed
            if speed > 0
            else float("inf")
        )
        here = _point_in_leg(leg, leg.duration_minutes - remaining)

        # Remedy priority: a 34-hour restart (cycle exhausted) outranks a 10-hour
        # reset, which outranks a fuel stop, which outranks a 30-min break. A
        # restart is >= 10h off duty so it also clears the period/window/break; a
        # fuel stop is non-driving >= 30 min so it satisfies the break.
        if state.on_duty_in_cycle >= MAX_CYCLE_ON_DUTY_MIN:
            clock = _append_restart(segments, clock, state, here)
            continue
        if (
            state.driving_in_period >= MAX_DRIVING_PER_PERIOD_MIN
            or state.elapsed_in_window >= MAX_DUTY_WINDOW_MIN
        ):
            clock = _append_reset(segments, clock, state, here)
            continue
        if minutes_to_fuel < 1:
            clock = _append_fuel_stop(segments, clock, state, here)
            continue
        if state.driving_since_break >= DRIVING_BEFORE_BREAK_MIN:
            clock = _append_break(segments, clock, state, here)
            continue

        # Drive the largest chunk allowed by every cap, stopping at the next
        # 1,000-mile boundary.
        drivable = min(
            remaining,
            MAX_DRIVING_PER_PERIOD_MIN - state.driving_in_period,
            MAX_DUTY_WINDOW_MIN - state.elapsed_in_window,
            DRIVING_BEFORE_BREAK_MIN - state.driving_since_break,
            MAX_CYCLE_ON_DUTY_MIN - state.on_duty_in_cycle,
        )
        if minutes_to_fuel != float("inf"):
            drivable = min(drivable, max(1, int(minutes_to_fuel)))

        miles = leg.distance_miles * drivable / leg.duration_minutes
        segments.append(
            DutySegment(
                start_min=clock,
                end_min=clock + drivable,
                status=DutyStatus.DRIVING,
                description=f"Drive to {leg.end.label}",
                start_location=here,
                end_location=_point_in_leg(leg, leg.duration_minutes - remaining + drivable),
                miles=miles,
            )
        )
        clock += drivable
        state.driving_in_period += drivable
        state.elapsed_in_window += drivable
        state.driving_since_break += drivable
        state.on_duty_in_cycle += drivable
        state.miles_since_fuel += miles
        remaining -= drivable

    return clock


def _append_reset(
    segments: list[DutySegment], clock: int, state: DriverState, where: Location
) -> int:
    """Insert a 10-hour off-duty reset; restart the 11h/14h and break clocks."""
    segments.append(
        DutySegment(
            start_min=clock,
            end_min=clock + MIN_RESET_OFF_DUTY_MIN,
            status=DutyStatus.OFF_DUTY,
            description="10-hour rest",
            start_location=where,
            end_location=where,
            miles=0.0,
        )
    )
    state.driving_in_period = 0
    state.elapsed_in_window = 0
    state.driving_since_break = 0
    return clock + MIN_RESET_OFF_DUTY_MIN


def _append_restart(
    segments: list[DutySegment], clock: int, state: DriverState, where: Location
) -> int:
    """Insert a 34-hour off-duty restart; reset the cycle and all daily clocks.

    Being >= 10h off duty, the restart also clears the 11h/14h and break clocks.
    Mileage-to-fuel is unaffected.
    """
    segments.append(
        DutySegment(
            start_min=clock,
            end_min=clock + RESTART_OFF_DUTY_MIN,
            status=DutyStatus.OFF_DUTY,
            description="34-hour restart",
            start_location=where,
            end_location=where,
            miles=0.0,
        )
    )
    state.on_duty_in_cycle = 0
    state.driving_in_period = 0
    state.elapsed_in_window = 0
    state.driving_since_break = 0
    return clock + RESTART_OFF_DUTY_MIN


def _append_break(
    segments: list[DutySegment], clock: int, state: DriverState, where: Location
) -> int:
    """Insert a 30-minute off-duty break; clear the since-break clock.

    The break consumes the 14h window (which never pauses) but does not touch
    the period or cycle clocks.
    """
    segments.append(
        DutySegment(
            start_min=clock,
            end_min=clock + MIN_BREAK_MIN,
            status=DutyStatus.OFF_DUTY,
            description="30-min break",
            start_location=where,
            end_location=where,
            miles=0.0,
        )
    )
    state.elapsed_in_window += MIN_BREAK_MIN
    state.driving_since_break = 0
    return clock + MIN_BREAK_MIN


def _append_fuel_stop(
    segments: list[DutySegment], clock: int, state: DriverState, where: Location
) -> int:
    """Insert an on-duty fuel stop; reset the mileage-to-fuel counter.

    A fuel stop is on-duty-not-driving and >= the 30-min break, so it also
    consumes the window, counts toward the cycle, and satisfies the break.
    """
    clock = _append_on_duty_stop(segments, clock, state, where, "Fuel stop", FUEL_STOP_MIN)
    state.miles_since_fuel = 0.0
    return clock


def _append_on_duty_stop(
    segments: list[DutySegment],
    clock: int,
    state: DriverState,
    where: Location,
    description: str,
    minutes: int,
) -> int:
    """Append an on-duty-not-driving stop of `minutes`; return the advanced clock.

    On-duty-not-driving time consumes the 14h window (which never pauses) and
    counts toward the cycle, but does not add to the driving clocks. Being >= the
    30-min break, such a stop also satisfies the break (§ 395.3(a)(3)(ii)).
    """
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
    state.elapsed_in_window += minutes
    state.on_duty_in_cycle += minutes
    if minutes >= MIN_BREAK_MIN:
        state.driving_since_break = 0
    return clock + minutes
