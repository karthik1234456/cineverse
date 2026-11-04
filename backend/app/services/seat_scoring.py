"""Viewing-comfort score and best-available seat finder (Phase 11).

HONESTY DISCLAIMER:
The thresholds below are CONFIGURABLE general guidance about screen angle comfort,
not a cinema standard and not a measurement of any physical room.
No obstruction (heads, rails) is modelled.
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field

_CACHED_LAYOUT_SEATS: Optional[List["ScoredSeatInput"]] = None


def get_layout_seats() -> List["ScoredSeatInput"]:
    """Loads and caches ScoredSeatInput from seat_layout_v2.json."""
    global _CACHED_LAYOUT_SEATS
    if _CACHED_LAYOUT_SEATS is not None:
        return _CACHED_LAYOUT_SEATS

    potential_paths = [
        Path("frontend/public/models/seat_layout_v2.json"),
        Path("../frontend/public/models/seat_layout_v2.json"),
        Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "models" / "seat_layout_v2.json",
        Path("seat_layout_v2_1.json"),
    ]

    target_path = None
    for p in potential_paths:
        if p.exists():
            target_path = p
            break

    if not target_path:
        raise FileNotFoundError("Could not find seat_layout_v2.json for seat scoring")

    with open(target_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    seats = []
    for s in data["seats"]:
        seats.append(
            ScoredSeatInput(
                seat_id=s["seat_id"],
                row=s["row"],
                number=s["number"],
                horizontal_offset_deg=s["horizontal_offset_deg"],
                vertical_angle_deg=s["vertical_angle_deg"],
                screen_h_fov_deg=s["screen_h_fov_deg"],
                position_gltf_y_up=tuple(s["position_gltf_y_up"]),
                category=s.get("category"),
            )
        )

    _CACHED_LAYOUT_SEATS = seats
    return _CACHED_LAYOUT_SEATS



@dataclass
class ScoredSeatInput:
    seat_id: str
    row: str
    number: int
    horizontal_offset_deg: float
    vertical_angle_deg: float
    screen_h_fov_deg: float
    position_gltf_y_up: Tuple[float, float, float]
    category: Optional[str] = None


@dataclass
class ScoreWeights:
    fov: float = 0.60
    offset: float = 0.25
    vertical: float = 0.15


@dataclass
class ScoreOptions:
    comfortable_h_fov: Tuple[float, float] = (28.0, 50.0)
    wide_fov_penalty_per_deg: float = 2.2
    narrow_fov_penalty_per_deg: float = 3.0
    free_offset_deg: float = 10.0
    offset_penalty_per_deg: float = 1.0
    max_offset_penalty: float = 35.0
    free_look_up_deg: float = 20.0
    look_up_penalty_per_deg: float = 2.0
    weights: ScoreWeights = field(default_factory=ScoreWeights)


DEFAULT_SCORE_OPTIONS = ScoreOptions()


def get_score_options_for_preference(preference: Optional[str] = None) -> ScoreOptions:
    pref = (preference or "balanced").lower()
    if pref == "centre":
        return ScoreOptions(
            comfortable_h_fov=(28.0, 50.0),
            wide_fov_penalty_per_deg=2.2,
            narrow_fov_penalty_per_deg=3.0,
            free_offset_deg=5.0,
            offset_penalty_per_deg=2.0,
            max_offset_penalty=50.0,
            free_look_up_deg=20.0,
            look_up_penalty_per_deg=2.0,
            weights=ScoreWeights(fov=0.45, offset=0.45, vertical=0.10)
        )
    elif pref == "sit_back":
        return ScoreOptions(
            comfortable_h_fov=(22.0, 38.0),
            wide_fov_penalty_per_deg=3.0,
            narrow_fov_penalty_per_deg=3.0,
            free_offset_deg=10.0,
            offset_penalty_per_deg=1.0,
            max_offset_penalty=35.0,
            free_look_up_deg=20.0,
            look_up_penalty_per_deg=2.0,
            weights=ScoreWeights(fov=0.65, offset=0.20, vertical=0.15)
        )
    elif pref == "no_neck_strain":
        return ScoreOptions(
            comfortable_h_fov=(28.0, 50.0),
            wide_fov_penalty_per_deg=2.2,
            narrow_fov_penalty_per_deg=3.0,
            free_offset_deg=10.0,
            offset_penalty_per_deg=1.0,
            max_offset_penalty=35.0,
            free_look_up_deg=12.0,
            look_up_penalty_per_deg=3.5,
            weights=ScoreWeights(fov=0.40, offset=0.20, vertical=0.40)
        )
    return DEFAULT_SCORE_OPTIONS


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def view_score(
    seat: ScoredSeatInput,
    options: ScoreOptions = DEFAULT_SCORE_OPTIONS
) -> Dict[str, Any]:
    """Calculates viewing comfort score (0-100) and human-readable reasons."""
    reasons: List[str] = []
    lo, hi = options.comfortable_h_fov
    f = seat.screen_h_fov_deg
    fov = 100.0

    if f > hi:
        fov = _clamp(100.0 - (f - hi) * options.wide_fov_penalty_per_deg)
        if f > hi + 20.0:
            reasons.append("very close, screen fills your whole view")
        else:
            reasons.append("a little close to the screen")
    elif f < lo:
        fov = _clamp(100.0 - (lo - f) * options.narrow_fov_penalty_per_deg)
        reasons.append("far from the screen")

    off = abs(seat.horizontal_offset_deg)
    off_pen = _clamp((off - options.free_offset_deg) * options.offset_penalty_per_deg, 0.0, options.max_offset_penalty)
    if off_pen > 5.0:
        reasons.append("off to the side of the screen")

    v_pen = _clamp((seat.vertical_angle_deg - options.free_look_up_deg) * options.look_up_penalty_per_deg, 0.0, 100.0)
    if v_pen > 0.0:
        reasons.append("you would look up at the screen")

    score = _clamp(
        fov * options.weights.fov +
        (100.0 - off_pen) * options.weights.offset +
        (100.0 - v_pen) * options.weights.vertical
    )

    final_score = round(score, 1)
    return {
        "score": final_score,
        "reasons": reasons if reasons else ["comfortable viewing angle (geometric estimate)"]
    }


def best_available(
    seats: List[ScoredSeatInput],
    status: Dict[str, str],
    n: int,
    aisle_after_numbers: Optional[List[int]] = None,
    allow_cross_aisle: bool = False,
    orphan_penalty: float = 8.0,
    score_options: Optional[ScoreOptions] = None,
    preference: Optional[str] = "balanced",
    category: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Contiguous same-row seats (not across an aisle by default) maximising score, penalising orphan single seats."""
    if n < 1:
        raise ValueError("n must be >= 1")

    pref = preference or "balanced"
    so = score_options or get_score_options_for_preference(pref)
    aisles = aisle_after_numbers or []
    penalty = orphan_penalty

    # Category filter
    candidate_seats = seats
    if category:
        filtered = [s for s in seats if s.category and s.category.lower() == category.lower()]
        if len(filtered) >= n:
            candidate_seats = filtered

    def is_free(s: ScoredSeatInput) -> bool:
        return status.get(s.seat_id, "available").lower() == "available"

    scored: Dict[str, float] = {s.seat_id: view_score(s, so)["score"] for s in candidate_seats}

    def affinity(s: ScoredSeatInput) -> float:
        bonus = 0.0
        if pref == "aisle":
            if s.number == 1 or s.number == 10 or s.number in aisles or (s.number - 1) in aisles:
                bonus += 15.0
        elif pref == "accessible":
            if s.row == "A":
                bonus += 20.0
        return bonus

    rows: Dict[str, List[ScoredSeatInput]] = {}
    for s in candidate_seats:
        rows.setdefault(s.row, []).append(s)

    best = None

    for r_list in rows.values():
        r = sorted(r_list, key=lambda s: s.number)
        for i in range(len(r) - n + 1):
            w = r[i:i + n]
            if not all(is_free(s) for s in w):
                continue

            if not allow_cross_aisle:
                crosses = False
                for k in range(1, len(w)):
                    if any(w[k - 1].number <= a < w[k].number for a in aisles):
                        crosses = True
                        break
                if crosses:
                    continue

            # Orphan seat count
            orphans = 0
            for side in (-1, 1):
                idx = i - 1 if side < 0 else i + n
                idx2 = i - 2 if side < 0 else i + n + 1
                nb1 = r[idx] if 0 <= idx < len(r) else None
                nb2 = r[idx2] if 0 <= idx2 < len(r) else None

                crosses_aisle = False
                if nb1:
                    if side < 0:
                        crosses_aisle = any(nb1.number <= a < w[0].number for a in aisles)
                    else:
                        crosses_aisle = any(w[n - 1].number <= a < nb1.number for a in aisles)

                if nb1 and not crosses_aisle and is_free(nb1):
                    nb2_free = is_free(nb2) if nb2 else False
                    nb2_crosses = False
                    if nb2:
                        if side < 0:
                            nb2_crosses = any(nb2.number <= a < nb1.number for a in aisles)
                        else:
                            nb2_crosses = any(nb1.number <= a < nb2.number for a in aisles)

                    if not nb2 or not nb2_free or nb2_crosses:
                        orphans += 1

            base_avg = sum(scored[s.seat_id] for s in w) / n
            affinity_bonus = sum(affinity(s) for s in w) / n
            value = base_avg + affinity_bonus - orphans * penalty
            centre = sum(abs(s.position_gltf_y_up[0]) for s in w) / n

            if (best is None or
                    value > best["value"] + 1e-9 or
                    (abs(value - best["value"]) <= 1e-9 and centre < best["centre"])):
                best = {
                    "ids": [s.seat_id for s in w],
                    "value": value,
                    "avg": base_avg,
                    "orphans": orphans,
                    "centre": centre
                }

    preference_reasons: List[str] = []
    if pref == "centre":
        preference_reasons.append("direct screen centre alignment")
    elif pref == "sit_back":
        preference_reasons.append("relaxed distance with wide room sightline")
    elif pref == "no_neck_strain":
        preference_reasons.append("minimal vertical look-up angle")
    elif pref == "aisle":
        preference_reasons.append("easy aisle access")
    elif pref == "accessible":
        preference_reasons.append("convenient step-free front row access")

    if best:
        return {
            "seat_ids": best["ids"],
            "avg_score": round(best["avg"], 1),
            "split": False,
            "orphan_seats": best["orphans"],
            "reasons": ["together in one row"] + preference_reasons
        }

    # Fallback to individual best seats if group cannot sit together
    free_seats = [s for s in candidate_seats if is_free(s)]
    free_seats.sort(
        key=lambda s: (-(scored[s.seat_id] + affinity(s)), s.seat_id)
    )

    if len(free_seats) < n:
        return None

    pick = free_seats[:n]
    avg = sum(scored[s.seat_id] for s in pick) / n

    return {
        "seat_ids": [s.seat_id for s in pick],
        "avg_score": round(avg, 1),
        "split": True,
        "orphan_seats": 0,
        "reasons": ["no seats together; best individual seats"] + preference_reasons
    }
