"""HOS compliance engine.

Pure Python: no Django imports, no I/O, no clock reads. Deterministic.
Works in integer minutes-from-trip-start; clock formatting happens at the edges.
"""

from dataclasses import dataclass


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
class TripInput:
    """The trip request: three resolved locations plus driver clock state.

    `cycle_hours_used` seeds the 70hr/8day counter; `start_time_minutes` is the
    minute-of-day the driver goes on duty (the trip's time origin).
    """

    current_location: Location
    pickup: Location
    dropoff: Location
    cycle_hours_used: float
    start_time_minutes: int


@dataclass(frozen=True)
class Segment:
    """One stretch of the timeline in a single duty status.

    `kind` is one of "driving", "on_duty", "off_duty", "sleeper". `start` and
    `duration` are integer minutes from trip start.
    """

    kind: str
    start: int
    duration: int


@dataclass(frozen=True)
class DayLog:
    """One calendar day of the timeline.

    `date_offset` is the number of days from trip start (0 = first day);
    `segments` are the duty-status stretches falling within that day.
    """

    date_offset: int
    segments: list[Segment]
