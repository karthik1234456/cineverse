import random
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple


def natural_seat_sort_key(seat_id: str) -> Tuple[str, int]:
    match = re.match(r"([A-Za-z]+)(\d+)", seat_id)
    if match:
        return match.group(1), int(match.group(2))
    return seat_id, 0


def generate_natural_occupancy(
    seats: List[Dict[str, Any]],
    start_time: Optional[datetime] = None,
    target_pct: Optional[float] = None,
    target_held: Optional[int] = None,
    special_mode: Optional[str] = None, # 'nearly_full' | 'sold_out' | None
) -> Tuple[List[str], List[str]]:
    """
    Computes natural booking & hold spreads for an auditorium's seats (§ Part C):
    - Evenings: 20% to 45% booked
    - Mornings: 5% to 15% booked
    - Special: a few nearly full (75-90%), a few sold out (100%)
    - Held: 0 to 3 seats
    - Spread: pairs (60%), small groups of 3-4 (25%), solo (15%)
    - Preference: central/prime rows have higher booking density than edge/front rows
    Returns (booked_seat_ids, held_seat_ids).
    """
    total_seats = len(seats)
    if total_seats == 0:
        return [], []

    # 1. Determine target occupancy percentage
    if target_pct is not None:
        pct = max(0.0, min(1.0, target_pct))
    elif special_mode == "sold_out":
        pct = 1.0
    elif special_mode == "nearly_full":
        pct = random.uniform(0.75, 0.90)
    else:
        hour = start_time.hour if start_time else 19
        if hour < 12:
            pct = random.uniform(0.05, 0.15)
        elif 12 <= hour < 17:
            pct = random.uniform(0.15, 0.25)
        elif 17 <= hour < 22:
            pct = random.uniform(0.20, 0.45)
        else:
            pct = random.uniform(0.20, 0.35)

    target_booked_count = int(round(total_seats * pct))

    # 2. Determine target held count (0 to 3)
    if target_held is not None:
        held_count = max(0, min(3, target_held))
    elif pct >= 0.98:
        held_count = 0
    else:
        held_count = random.choices([0, 1, 2, 3], weights=[0.50, 0.25, 0.15, 0.10])[0]

    if pct >= 1.0:
        return [s["seat_id"] for s in seats], []

    # Group seats by row
    rows_map: Dict[str, List[Dict[str, Any]]] = {}
    for s in seats:
        s_id = s["seat_id"]
        row = s_id[0] if s_id else "A"
        if row not in rows_map:
            rows_map[row] = []
        rows_map[row].append(s)

    for row in rows_map:
        rows_map[row].sort(key=lambda x: natural_seat_sort_key(x["seat_id"]))

    all_rows = sorted(rows_map.keys())
    num_rows = len(all_rows)

    # Compute row weights (center/back rows are more desirable than front rows)
    row_weights = []
    for idx, r in enumerate(all_rows):
        rel_pos = (idx + 1) / max(num_rows, 1)
        # Peak around 0.60 to 0.75 of hall depth
        weight = max(0.2, 1.0 - abs(rel_pos - 0.65) * 1.5)
        row_weights.append(weight)

    booked_ids = set()
    held_ids = set()

    # Allocate bookings in natural clusters (pairs, small groups, solo)
    attempts = 0
    while len(booked_ids) < target_booked_count and attempts < 500:
        attempts += 1
        chosen_row = random.choices(all_rows, weights=row_weights)[0]
        row_seats = rows_map[chosen_row]
        available_in_row = [s for s in row_seats if s["seat_id"] not in booked_ids]

        if not available_in_row:
            continue

        # Choose group size: pairs (60%), 3-4 (25%), solo (15%)
        group_roll = random.random()
        if group_roll < 0.60:
            desired_size = 2
        elif group_roll < 0.85:
            desired_size = random.choice([3, 4])
        else:
            desired_size = 1

        desired_size = min(desired_size, target_booked_count - len(booked_ids))
        if desired_size <= 0:
            break

        # Find contiguous run in row
        # Center-weighted start within row
        placed = False
        candidates = []
        for i in range(len(row_seats) - desired_size + 1):
            chunk = row_seats[i : i + desired_size]
            if all(s["seat_id"] not in booked_ids for s in chunk):
                # Check contiguous numbers
                nums = [natural_seat_sort_key(s["seat_id"])[1] for s in chunk]
                is_contiguous = all(nums[j] == nums[j - 1] + 1 for j in range(1, len(nums)))
                if is_contiguous:
                    # Weight by distance from center of row
                    center_dist = abs(i + desired_size / 2 - len(row_seats) / 2)
                    candidates.append((center_dist, chunk))

        if candidates:
            candidates.sort(key=lambda c: c[0] + random.uniform(0, 3))
            selected_chunk = candidates[0][1]
            for s in selected_chunk:
                booked_ids.add(s["seat_id"])
            placed = True

        if not placed:
            # Fallback pick any available seat
            s = random.choice(available_in_row)
            booked_ids.add(s["seat_id"])

    # Allocate held seats (0 to 3) from remaining available seats
    remaining = [s for s in seats if s["seat_id"] not in booked_ids]
    if remaining and held_count > 0:
        held_count = min(held_count, len(remaining))
        # If held_count == 2, try to find a pair
        if held_count == 2:
            pair_found = False
            for r in all_rows:
                avail_row = [s for s in rows_map[r] if s["seat_id"] not in booked_ids]
                for i in range(len(avail_row) - 1):
                    s1 = avail_row[i]
                    s2 = avail_row[i + 1]
                    n1 = natural_seat_sort_key(s1["seat_id"])[1]
                    n2 = natural_seat_sort_key(s2["seat_id"])[1]
                    if n2 == n1 + 1:
                        held_ids.add(s1["seat_id"])
                        held_ids.add(s2["seat_id"])
                        pair_found = True
                        break
                if pair_found:
                    break
            if not pair_found:
                chosen = random.sample(remaining, held_count)
                for s in chosen:
                    held_ids.add(s["seat_id"])
        else:
            chosen = random.sample(remaining, held_count)
            for s in chosen:
                held_ids.add(s["seat_id"])

    return sorted(list(booked_ids), key=natural_seat_sort_key), sorted(list(held_ids), key=natural_seat_sort_key)
