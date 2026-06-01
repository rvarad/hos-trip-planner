from hos.engine import (
    DayLog,
    DriverState,
    DutySegment,
    Location,
    PlanResult,
    RouteLeg,
    TripInput,
    plan_trip,
)
from hos.rules import DutyStatus

CHICAGO = Location(label="Chicago, IL", lat=41.8781, lng=-87.6298)
ST_LOUIS = Location(label="St. Louis, MO", lat=38.6270, lng=-90.1994)
DALLAS = Location(label="Dallas, TX", lat=32.7767, lng=-96.7970)


def _sample_legs():
    return [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=297.0, duration_minutes=270),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=630.0, duration_minutes=570),
    ]


def test_location_fields_accessible():
    assert CHICAGO.label == "Chicago, IL"
    assert CHICAGO.lat == 41.8781
    assert CHICAGO.lng == -87.6298


def test_route_leg_fields_accessible():
    leg = RouteLeg(
        start=CHICAGO,
        end=ST_LOUIS,
        distance_miles=297.0,
        duration_minutes=270,
        geometry=((41.8781, -87.6298), (38.6270, -90.1994)),
    )
    assert leg.start.label == "Chicago, IL"
    assert leg.end.label == "St. Louis, MO"
    assert leg.distance_miles == 297.0
    assert leg.duration_minutes == 270
    assert leg.geometry[0] == (41.8781, -87.6298)


def test_route_leg_geometry_defaults_empty():
    leg = RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=297.0, duration_minutes=270)
    assert leg.geometry == ()


def test_trip_input_fields_accessible():
    trip = TripInput(
        legs=_sample_legs(),
        current_cycle_used_minutes=750,
        start_time_minutes=480,
    )
    assert len(trip.legs) == 2
    assert trip.legs[0].start.label == "Chicago, IL"
    assert trip.legs[1].end.label == "Dallas, TX"
    assert trip.current_cycle_used_minutes == 750
    assert trip.start_time_minutes == 480


def test_driver_state_defaults_zero():
    state = DriverState()
    assert state.driving_since_break == 0
    assert state.driving_in_period == 0
    assert state.elapsed_in_window == 0
    assert state.on_duty_in_cycle == 0
    assert state.miles_since_fuel == 0.0


def test_driver_state_is_mutable():
    state = DriverState()
    state.driving_in_period += 60
    state.miles_since_fuel += 55.0
    assert state.driving_in_period == 60
    assert state.miles_since_fuel == 55.0


def test_duty_segment_fields_accessible():
    seg = DutySegment(
        start_min=0,
        end_min=270,
        status=DutyStatus.DRIVING,
        description="Drive to pickup",
        start_location=CHICAGO,
        end_location=ST_LOUIS,
        miles=297.0,
    )
    assert seg.start_min == 0
    assert seg.end_min == 270
    assert seg.status == DutyStatus.DRIVING
    assert seg.description == "Drive to pickup"
    assert seg.start_location.label == "Chicago, IL"
    assert seg.end_location.label == "St. Louis, MO"
    assert seg.miles == 297.0


def test_day_log_fields_accessible():
    seg = DutySegment(
        start_min=0,
        end_min=270,
        status=DutyStatus.DRIVING,
        description="Drive to pickup",
        start_location=CHICAGO,
        end_location=ST_LOUIS,
        miles=297.0,
    )
    day = DayLog(date_offset=0, segments=[seg])
    assert day.date_offset == 0
    assert day.segments[0].status == DutyStatus.DRIVING


def test_plan_result_fields_accessible():
    result = PlanResult(segments=[], days=[], total_miles=0.0)
    assert result.segments == []
    assert result.days == []
    assert result.total_miles == 0.0


def test_plan_trip_walks_legs():
    # A short trip that stays within every HOS limit, so this stays valid as
    # later subtasks add splitting: 250 mi, 5h driving, no break/fuel/reset.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=100.0, duration_minutes=120),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=150.0, duration_minutes=180),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    assert [s.status for s in result.segments] == [
        DutyStatus.DRIVING,
        DutyStatus.ON_DUTY_NOT_DRIVING,
        DutyStatus.DRIVING,
        DutyStatus.ON_DUTY_NOT_DRIVING,
    ]
    # Driving durations match each leg; both stops are 60 min.
    durations = [s.end_min - s.start_min for s in result.segments]
    assert durations == [120, 60, 180, 60]
    # Contiguous from minute 0.
    assert result.segments[0].start_min == 0
    for earlier, later in zip(result.segments, result.segments[1:]):
        assert later.start_min == earlier.end_min
    assert result.total_miles == 250.0
    assert result.days == []


def test_plan_trip_resets_at_11h_driving_limit():
    # 13h of driving forces a split: 11h cap is reached, a 10-hour reset is
    # inserted, then driving resumes.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=50.0, duration_minutes=60),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=600.0, duration_minutes=720),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    # Exactly one 10-hour off-duty reset (OFF_DUTY also covers 30-min breaks,
    # so isolate the reset by its duration).
    resets = [
        s
        for s in result.segments
        if s.status == DutyStatus.OFF_DUTY and (s.end_min - s.start_min) >= 600
    ]
    assert len(resets) == 1
    assert resets[0].end_min - resets[0].start_min == 600

    # Driving and miles conserved across the split.
    driving = [s for s in result.segments if s.status == DutyStatus.DRIVING]
    assert sum(s.end_min - s.start_min for s in driving) == 780
    assert result.total_miles == 650.0

    # Invariant: within any duty period (between ≥600-min off-duty resets),
    # driving never exceeds 11h (660) and the window never exceeds 14h (840).
    drive_in_period = 0
    window = 0
    for s in result.segments:
        dur = s.end_min - s.start_min
        if s.status == DutyStatus.OFF_DUTY and dur >= 600:
            drive_in_period = 0
            window = 0
            continue
        if s.status == DutyStatus.DRIVING:
            drive_in_period += dur
        window += dur
        assert drive_in_period <= 660
        assert window <= 840


def test_plan_trip_inserts_break_after_8h_driving():
    # After the pickup resets the break clock, leg1 has 9h of continuous driving,
    # which forces a 30-minute break at the 8h mark.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=25.0, duration_minutes=30),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=450.0, duration_minutes=540),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    breaks = [
        s
        for s in result.segments
        if s.status == DutyStatus.OFF_DUTY and (s.end_min - s.start_min) < 600
    ]
    assert len(breaks) == 1
    assert breaks[0].end_min - breaks[0].start_min == 30
    # No 10-hour reset was needed (driving stays under 11h within the period).
    assert not [
        s
        for s in result.segments
        if s.status == DutyStatus.OFF_DUTY and (s.end_min - s.start_min) >= 600
    ]

    # Invariant: driving-since-break never exceeds 8h (480); any non-driving
    # segment >= 30 min resets it.
    since_break = 0
    for s in result.segments:
        dur = s.end_min - s.start_min
        if s.status != DutyStatus.DRIVING and dur >= 30:
            since_break = 0
            continue
        if s.status == DutyStatus.DRIVING:
            since_break += dur
        assert since_break <= 480


def test_stop_satisfies_break():
    # A pickup (>= 30-min non-driving) before the 8h mark resets the break clock,
    # so no dedicated break is inserted: 7h drive, pickup, 1h drive.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=350.0, duration_minutes=420),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=50.0, duration_minutes=60),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    # No off-duty segments at all: no break, no reset.
    assert not [s for s in result.segments if s.status == DutyStatus.OFF_DUTY]
