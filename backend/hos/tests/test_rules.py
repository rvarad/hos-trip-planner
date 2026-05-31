from hos import rules
from hos.rules import DutyStatus


def test_hos_limits():
    assert rules.MAX_DRIVING_PER_PERIOD_MIN == 660
    assert rules.MAX_DUTY_WINDOW_MIN == 840
    assert rules.DRIVING_BEFORE_BREAK_MIN == 480
    assert rules.MIN_BREAK_MIN == 30
    assert rules.MIN_RESET_OFF_DUTY_MIN == 600
    assert rules.MAX_CYCLE_ON_DUTY_MIN == 4200
    assert rules.CYCLE_DAYS == 8
    assert rules.RESTART_OFF_DUTY_MIN == 2040


def test_assessment_assumptions():
    assert rules.PICKUP_MIN == 60
    assert rules.DROPOFF_MIN == 60
    assert rules.FUEL_INTERVAL_MILES == 1000
    assert rules.FUEL_STOP_MIN == 30


def test_fuel_stop_satisfies_break():
    # A fuel stop is on-duty-not-driving and >= the 30-min break, so it also
    # satisfies the § 395.3(a)(3)(ii) break.
    assert rules.FUEL_STOP_MIN >= rules.MIN_BREAK_MIN


def test_duty_status_values():
    assert DutyStatus.OFF_DUTY == "off_duty"
    assert DutyStatus.SLEEPER_BERTH == "sleeper_berth"
    assert DutyStatus.DRIVING == "driving"
    assert DutyStatus.ON_DUTY_NOT_DRIVING == "on_duty_not_driving"
