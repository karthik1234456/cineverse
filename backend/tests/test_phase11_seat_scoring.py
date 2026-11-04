import json
from pathlib import Path
import pytest
from app.services.seat_scoring import (
    ScoredSeatInput,
    ScoreOptions,
    DEFAULT_SCORE_OPTIONS,
    get_score_options_for_preference,
    view_score,
    best_available,
)


def load_layout_seats():
    root = Path(__file__).resolve().parent.parent.parent
    layout_path = root / "frontend" / "public" / "models" / "seat_layout_v2.json"
    with open(layout_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    seats = []
    for s in data["seats"]:
        seats.append(ScoredSeatInput(
            seat_id=s["seat_id"],
            row=s["row"],
            number=s["number"],
            horizontal_offset_deg=s["horizontal_offset_deg"],
            vertical_angle_deg=s["vertical_angle_deg"],
            screen_h_fov_deg=s["screen_h_fov_deg"],
            position_gltf_y_up=tuple(s["position_gltf_y_up"]),
            category=s.get("category")
        ))
    return seats


def test_front_centre_vs_back_centre_vs_far_side():
    seats = load_layout_seats()
    seat_map = {s.seat_id: s for s in seats}

    front_centre = view_score(seat_map["A05"])
    back_centre = view_score(seat_map["J05"])
    front_side = view_score(seat_map["A01"])

    # Front centre warns about close screen distance / wide FOV
    assert any("close" in r for r in front_centre["reasons"])

    # Far side warns about being off to the side
    assert any("side" in r for r in front_side["reasons"])

    # Front centre sightline is more central than front side
    assert front_centre["score"] > front_side["score"]

    # Back centre has a comfortable score (> 50)
    assert back_centre["score"] > 50.0


def test_monotonic_score_drop_off_centre():
    seats = load_layout_seats()
    row_f = [s for s in seats if s.row == "F"]
    row_f.sort(key=lambda s: abs(s.horizontal_offset_deg))

    scores = [view_score(s)["score"] for s in row_f]
    for i in range(1, len(scores)):
        assert scores[i] <= scores[i - 1] + 0.1, f"Seat {row_f[i].seat_id} score unexpectedly jumped"


def test_scoring_preferences():
    seats = load_layout_seats()
    seat_map = {s.seat_id: s for s in seats}

    side_seat = seat_map["F01"]
    centre_opts = get_score_options_for_preference("centre")

    normal_score = view_score(side_seat, DEFAULT_SCORE_OPTIONS)["score"]
    penalised_score = view_score(side_seat, centre_opts)["score"]

    assert penalised_score < normal_score


def test_parity_with_ts_formula():
    """Verify that Python formula matches TypeScript formula exactly for all 100 seats."""
    seats = load_layout_seats()
    for s in seats:
        py_res = view_score(s)
        # Compute TS equivalent clamp
        def clamp(v, lo=0.0, hi=100.0):
            return max(lo, min(hi, v))

        lo, hi = DEFAULT_SCORE_OPTIONS.comfortable_h_fov
        f = s.screen_h_fov_deg
        fov = 100.0
        if f > hi:
            fov = clamp(100.0 - (f - hi) * DEFAULT_SCORE_OPTIONS.wide_fov_penalty_per_deg)
        elif f < lo:
            fov = clamp(100.0 - (lo - f) * DEFAULT_SCORE_OPTIONS.narrow_fov_penalty_per_deg)

        off = abs(s.horizontal_offset_deg)
        off_pen = clamp(
            (off - DEFAULT_SCORE_OPTIONS.free_offset_deg) * DEFAULT_SCORE_OPTIONS.offset_penalty_per_deg,
            0.0,
            DEFAULT_SCORE_OPTIONS.max_offset_penalty
        )
        v_pen = clamp(
            (s.vertical_angle_deg - DEFAULT_SCORE_OPTIONS.free_look_up_deg) * DEFAULT_SCORE_OPTIONS.look_up_penalty_per_deg,
            0.0,
            100.0
        )
        expected_score = clamp(
            fov * DEFAULT_SCORE_OPTIONS.weights.fov +
            (100.0 - off_pen) * DEFAULT_SCORE_OPTIONS.weights.offset +
            (100.0 - v_pen) * DEFAULT_SCORE_OPTIONS.weights.vertical
        )
        assert abs(py_res["score"] - round(expected_score, 1)) < 1e-5


def test_best_available_contiguous_and_orphans():
    seats = load_layout_seats()
    status = {s.seat_id: "available" for s in seats}

    # Best 2 seats should be together in one row
    res2 = best_available(seats, status, 2)
    assert res2 is not None
    assert len(res2["seat_ids"]) == 2
    assert res2["split"] is False
    assert res2["seat_ids"][0][0] == res2["seat_ids"][1][0]  # Same row

    # Best 3 in prime
    res3_prime = best_available(seats, status, 3, category="prime")
    assert res3_prime is not None
    assert len(res3_prime["seat_ids"]) == 3
    for s_id in res3_prime["seat_ids"]:
        s = next(x for x in seats if x.seat_id == s_id)
        assert s.category.lower() == "prime"

    # Aisle preference selects an aisle seat (number 1 or 10)
    aisle_res = best_available(seats, status, 1, preference="aisle")
    assert aisle_res is not None
    assert int(aisle_res["seat_ids"][0][1:]) in [1, 10]

