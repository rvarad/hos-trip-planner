from hos.engine import (
    DayLog,
    DriverState,
    DutySegment,
    Location,
    PlanResult,
    RouteLeg,
    TripInput,
    _point_in_leg,
    plan_trip,
    rolling_cycle_minutes,
    slice_days,
)
from hos.rules import DutyStatus

_LOC = Location(label="X", lat=1.0, lng=2.0)


def _seg(start, end, status=DutyStatus.DRIVING, miles=0.0):
    return DutySegment(
        start_min=start,
        end_min=end,
        status=status,
        description="seg",
        start_location=_LOC,
        end_location=_LOC,
        miles=miles,
    )

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
    # The whole short trip fits in day 0; driving starts at the 08:00 default.
    assert len(result.days) == 1
    assert result.days[0].date_offset == 0
    assert result.days[0].segments[0].start_min == 480


def test_plan_trip_resets_at_11h_driving_limit():
    # 13h of driving forces a split: 11h cap is reached, a 10-hour reset is
    # inserted, then driving resumes.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=50.0, duration_minutes=60),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=600.0, duration_minutes=720),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    # Exactly one 10-hour reset, logged as sleeper berth (T14). Off-duty is
    # reserved for short breaks and the pre/post-trip grid fill, so the reset is
    # the only sleeper-berth segment.
    resets = [s for s in result.segments if s.status == DutyStatus.SLEEPER_BERTH]
    assert len(resets) == 1
    assert resets[0].description == "10-hour rest"
    assert resets[0].end_min - resets[0].start_min == 600

    # Driving and miles conserved across the split.
    driving = [s for s in result.segments if s.status == DutyStatus.DRIVING]
    assert sum(s.end_min - s.start_min for s in driving) == 780
    assert result.total_miles == 650.0

    # Invariant: within any duty period (between sleeper-berth 10h resets),
    # driving never exceeds 11h (660) and the window never exceeds 14h (840).
    drive_in_period = 0
    window = 0
    for s in result.segments:
        dur = s.end_min - s.start_min
        if s.status == DutyStatus.SLEEPER_BERTH and dur >= 600:
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
    # No 10-hour reset was needed (driving stays under 11h within the period),
    # so there is no sleeper-berth segment.
    assert not [s for s in result.segments if s.status == DutyStatus.SLEEPER_BERTH]

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


def test_fuel_stop_every_1000_miles():
    # 1,500 miles crosses the 1,000-mile boundary exactly once.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=50.0, duration_minutes=30),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=1450.0, duration_minutes=300),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    fuel_stops = [s for s in result.segments if s.description == "Fuel stop"]
    assert len(fuel_stops) == 1
    assert fuel_stops[0].status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert fuel_stops[0].end_min - fuel_stops[0].start_min == 30
    assert result.total_miles == 1500.0


def test_fuel_stop_satisfies_break():
    # The fuel stop falls at 300 min of driving, with another 300 min after.
    # Total continuous driving is 600 min (> 8h), so a dedicated break would be
    # required UNLESS the fuel stop reset the break clock.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=30.0, duration_minutes=30),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=1940.0, duration_minutes=600),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    assert len([s for s in result.segments if s.description == "Fuel stop"]) == 1
    # No off-duty segments: the fuel stop satisfied the break, and the period
    # never exhausted, so neither a break nor a reset was inserted.
    assert not [s for s in result.segments if s.status == DutyStatus.OFF_DUTY]


def test_cycle_cap_inserts_34h_restart():
    # Seeded at 69h, only 60 min of on-duty remains before the 70h cap, forcing
    # a 34-hour restart partway through the trip.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=100.0, duration_minutes=120),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=150.0, duration_minutes=180),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=69 * 60, start_time_minutes=480)
    result = plan_trip(trip)

    restarts = [
        s
        for s in result.segments
        if s.status == DutyStatus.OFF_DUTY and (s.end_min - s.start_min) == 2040
    ]
    assert len(restarts) == 1
    # Driving resumes after the restart.
    restart_end = restarts[0].end_min
    assert any(
        s.status == DutyStatus.DRIVING and s.start_min >= restart_end
        for s in result.segments
    )


def test_point_in_leg_follows_road_geometry():
    # The road bends well north of the straight A->B chord (which lies on lat 0).
    # A mid-leg point must sit on the bend, not on the chord, so map markers land
    # on the route line (T11.2). The two geometry segments are mirror images, so
    # the midpoint by distance is the apex vertex.
    leg = RouteLeg(
        start=Location(label="A", lat=0.0, lng=0.0),
        end=Location(label="B", lat=0.0, lng=2.0),
        distance_miles=100.0,
        duration_minutes=100,
        geometry=((0.0, 0.0), (1.0, 1.0), (0.0, 2.0)),
    )
    mid = _point_in_leg(leg, 50)
    assert mid.lat > 0.5  # up on the bend, far off the lat-0 chord
    assert abs(mid.lng - 1.0) < 0.01  # at the apex (lng 1.0)


def test_point_in_leg_falls_back_without_geometry():
    # No geometry -> straight-line interpolation between the endpoints.
    leg = RouteLeg(
        start=Location(label="A", lat=0.0, lng=0.0),
        end=Location(label="B", lat=10.0, lng=20.0),
        distance_miles=100.0,
        duration_minutes=100,
    )
    mid = _point_in_leg(leg, 50)
    assert mid.lat == 5.0
    assert mid.lng == 10.0


def test_mid_leg_stop_has_interpolated_location():
    # The fuel stop lands mid-leg1 (St. Louis -> Dallas), so its location is an
    # interpolated point between those endpoints.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=50.0, duration_minutes=30),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=1450.0, duration_minutes=300),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    fuel = next(s for s in result.segments if s.description == "Fuel stop")
    loc = fuel.start_location
    assert min(ST_LOUIS.lat, DALLAS.lat) < loc.lat < max(ST_LOUIS.lat, DALLAS.lat)
    assert min(ST_LOUIS.lng, DALLAS.lng) < loc.lng < max(ST_LOUIS.lng, DALLAS.lng)
    assert "En route" in loc.label

    # Trip endpoints keep full fidelity (not interpolated).
    first_drive = next(s for s in result.segments if s.status == DutyStatus.DRIVING)
    assert first_drive.start_location == CHICAGO


def test_rolling_cycle_matches_fmcsa_8day_table():
    # FMCSA Interstate Truck Driver's Guide, "70-hour/8-day rule: Calculating the
    # rolling 8-day total" (p.11). Daily on-duty hours converted to minutes.
    daily = [int(h * 60) for h in [0, 10, 8.5, 12.5, 9, 10, 12, 5, 6, 0]]

    # Published rolling 8-day totals at each window end.
    assert rolling_cycle_minutes(daily, 7) == 67 * 60  # Days 1-8
    assert rolling_cycle_minutes(daily, 8) == 73 * 60  # Days 2-9
    assert rolling_cycle_minutes(daily, 9) == 63 * 60  # Days 3-10

    # Before a full window has elapsed, only the days so far are counted.
    assert rolling_cycle_minutes(daily, 0) == 0


def test_plan_trip_populates_days():
    # ~1530-min timeline (with a 10-hour reset) crosses midnight from an 8am start.
    legs = [
        RouteLeg(start=CHICAGO, end=ST_LOUIS, distance_miles=50.0, duration_minutes=60),
        RouteLeg(start=ST_LOUIS, end=DALLAS, distance_miles=600.0, duration_minutes=720),
    ]
    trip = TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=480)
    result = plan_trip(trip)

    assert len(result.days) >= 2
    assert [d.date_offset for d in result.days] == list(range(len(result.days)))
    assert all(
        0 <= s.start_min < s.end_min <= 1440
        for d in result.days
        for s in d.segments
    )


def test_slice_days_single_day():
    # An 8am start; a 0-120 min driving segment lands at 08:00-10:00 on day 0.
    days = slice_days([_seg(0, 120)], start_time_minutes=480)
    assert len(days) == 1
    assert days[0].date_offset == 0
    assert days[0].segments[0].start_min == 480
    assert days[0].segments[0].end_min == 600


def test_slice_days_splits_at_midnight():
    # 8am start; trip-minutes 900-1100 is absolute 1380-1580, crossing midnight.
    days = slice_days([_seg(900, 1100, status=DutyStatus.OFF_DUTY)], start_time_minutes=480)
    assert [d.date_offset for d in days] == [0, 1]
    assert days[0].segments[-1].end_min == 1440
    assert days[1].segments[0].start_min == 0
    assert days[1].segments[0].end_min == 140


def test_slice_days_conserves_duration_and_miles():
    # A long segment spanning more than one day.
    days = slice_days([_seg(0, 2000, miles=100.0)], start_time_minutes=600)
    total_minutes = sum(s.end_min - s.start_min for d in days for s in d.segments)
    total_miles = sum(s.miles for d in days for s in d.segments)
    assert total_minutes == 2000
    assert abs(total_miles - 100.0) < 1e-9
    # Every day-local time stays within a calendar day.
    assert all(0 <= s.start_min < s.end_min <= 1440 for d in days for s in d.segments)


def test_segments_carry_hos_clock_snapshots():
    # Leg 1 is 270 min of driving and trips no limit, so it is one DRIVING
    # segment; its clocks reflect 270 min spent against the period/window.
    result = plan_trip(
        TripInput(legs=_sample_legs(), current_cycle_used_minutes=0, start_time_minutes=0)
    )
    assert all(seg.clocks is not None for seg in result.segments)

    first = result.segments[0]
    assert first.status == DutyStatus.DRIVING
    assert first.clocks.drive_remaining_min == 11 * 60 - 270
    assert first.clocks.window_remaining_min == 14 * 60 - 270
    assert first.clocks.break_remaining_min == 8 * 60 - 270
    assert first.clocks.cycle_remaining_min == 70 * 60 - 270

    # The pickup is an on-duty stop (>= 30 min): it resets the break clock and
    # consumes window + cycle (270 drive + 60 pickup).
    pickup = result.segments[1]
    assert pickup.description == "Pickup"
    assert pickup.clocks.break_remaining_min == 8 * 60
    assert pickup.clocks.window_remaining_min == 14 * 60 - 330
    assert pickup.clocks.cycle_remaining_min == 70 * 60 - 330


def test_clocks_reset_after_a_ten_hour_rest():
    # A 15-hour drive forces a 10-hour reset; its snapshot shows the 11h/14h
    # clocks back to full.
    legs = [RouteLeg(start=CHICAGO, end=DALLAS, distance_miles=1000.0, duration_minutes=900)]
    result = plan_trip(
        TripInput(legs=legs, current_cycle_used_minutes=0, start_time_minutes=0)
    )
    rests = [s for s in result.segments if s.description == "10-hour rest"]
    assert rests, "expected at least one 10-hour reset on a 15-hour drive"
    assert rests[0].clocks.drive_remaining_min == 11 * 60
    assert rests[0].clocks.window_remaining_min == 14 * 60
