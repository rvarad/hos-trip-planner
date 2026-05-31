"""
hos/rules.py — Source of truth for the federal Hours of Service limits.

All limits are transcribed from the FMCSA *Interstate Truck Driver's Guide to
Hours of Service for Property Carriers* (49 CFR Part 395). They apply to a
property-carrying driver on the 70-hour / 8-day cycle, with no adverse driving
conditions and no short-haul exception.

Durations are INTEGER MINUTES, matching the engine's minutes-from-trip-start
convention. Convert to wall-clock time only at the edges.
"""

from enum import Enum


class DutyStatus(str, Enum):
    """The four duty statuses on an ELD daily log (the four grid rows)."""
    OFF_DUTY = "off_duty"
    SLEEPER_BERTH = "sleeper_berth"
    DRIVING = "driving"
    ON_DUTY_NOT_DRIVING = "on_duty_not_driving"


# ── FMCSA Hours of Service limits (property carrier, 70/8, no exceptions) ──

# § 395.3(a)(3) — 11-hour driving limit.
# Max driving within one duty period, after 10 consecutive hours off.
MAX_DRIVING_PER_PERIOD_MIN = 11 * 60  # 660

# § 395.3(a)(2) — 14-hour driving window.
# No driving beyond the 14th consecutive hour after going on duty. The window
# begins at the FIRST on-duty moment and does NOT pause for breaks, meals, fuel,
# or any non-driving time. Only a 10-hour reset clears it.
MAX_DUTY_WINDOW_MIN = 14 * 60  # 840

# § 395.3(a)(3)(ii) — 30-minute break.
# Required after 8 CUMULATIVE driving hours since the last qualifying break.
DRIVING_BEFORE_BREAK_MIN = 8 * 60  # 480
# The break is 30 CONSECUTIVE minutes of non-driving. It may be off-duty,
# sleeper-berth, OR on-duty-not-driving (fueling, loading, paperwork all count).
# => any single non-driving segment >= this length resets the since-break clock.
MIN_BREAK_MIN = 30

# § 395.3(a)(1) — 10-hour reset.
# 10 consecutive hours off duty (or sleeper) restarts the 11h and 14h clocks.
MIN_RESET_OFF_DUTY_MIN = 10 * 60  # 600

# § 395.3(b) — 70-hour / 8-day on-duty limit.
# Total ON-DUTY time (driving + on-duty-not-driving) over a rolling 8 days.
# Seeded by the driver's "current cycle used" input.
MAX_CYCLE_ON_DUTY_MIN = 70 * 60  # 4200
CYCLE_DAYS = 8

# § 395.3(c) — 34-hour restart.
# 34+ consecutive hours off duty resets the cycle clock to zero. Optional.
RESTART_OFF_DUTY_MIN = 34 * 60  # 2040


# ── Assessment assumptions (NOT FMCSA rules — fixed by the task brief) ──

PICKUP_MIN = 60             # 1 hour on-duty (not driving) at pickup
DROPOFF_MIN = 60            # 1 hour on-duty (not driving) at drop-off
FUEL_INTERVAL_MILES = 1000  # fuel at least once every 1,000 miles
FUEL_STOP_MIN = 30          # ASSUMED duration; on-duty (not driving). It is
                            # >= MIN_BREAK_MIN, so a fuel stop also satisfies
                            # the 30-minute break.

# Out of scope for the MVP (note in ADR): sleeper-berth splits (§ 395.1(g)) and
# the adverse-driving-conditions extension (§ 395.1(b)).
