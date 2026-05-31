from hos import rules


def test_hos_constants():
    assert rules.MAX_DRIVING_MINUTES == 660
    assert rules.DRIVING_WINDOW_MINUTES == 840
    assert rules.BREAK_AFTER_MINUTES == 480
    assert rules.BREAK_DURATION_MINUTES == 30
    assert rules.CYCLE_HOURS == 70
    assert rules.CYCLE_DAYS == 8
    assert rules.REST_RESET_MINUTES == 600
