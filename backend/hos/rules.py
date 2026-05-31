"""HOS constants and limit checks (property carrier, 70hr/8day, no adverse conditions).

Duty-clock limits are integer minutes, matching the engine's minutes-from-trip-start
convention; all are multiples of 15 so they render exactly on the ELD log's
quarter-hour grid. The cycle limits stay in their natural hours/days units, matching
the form's recap section and the user-supplied `cycle_hours_used` input.
"""

MAX_DRIVING_MINUTES = 11 * 60  # 11-hour driving limit per duty period
DRIVING_WINDOW_MINUTES = 14 * 60  # 14-hour on-duty window; breaks do NOT pause it
BREAK_AFTER_MINUTES = 8 * 60  # 30-min break required after 8h cumulative driving
BREAK_DURATION_MINUTES = 30  # the required break itself
REST_RESET_MINUTES = 10 * 60  # 10 consecutive hours off duty resets the 11h/14h clocks

CYCLE_HOURS = 70  # 70 on-duty hours per rolling cycle
CYCLE_DAYS = 8  # the rolling window length, in days
