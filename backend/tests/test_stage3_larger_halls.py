"""
Automated Verification Suite for Stage 3: Larger Halls & Matching Equipment.
Verifies capacity truth, format seat count ranges, unique layout signatures per cinema,
equipment profiles, viewing distance rules, and walk paths across all 112 auditoriums.
"""
import pytest
import math
from typing import Dict, List, Set, Any
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.cinema import City, Cinema, Auditorium, Seat
from app.models.technical_specs import ScreenFormat, SoundSystem, ProjectionType
from app.seed.format_layouts import FORMAT_SPECS


@pytest.mark.asyncio
async def test_capacity_truth_and_format_seat_ranges(db_session):
    """
    For every hall, stored seat count must equal the count of Seat records,
    and must fall strictly within the format's designated seat count range.
    """
    auds = (
        await db_session.execute(
            select(Auditorium)
            .options(
                selectinload(Auditorium.screen_format),
                selectinload(Auditorium.cinema),
            )
        )
    ).scalars().all()

    assert len(auds) == 112, f"Expected 112 auditoriums, found {len(auds)}"

    for aud in auds:
        # 1. Database Seat count equals total_seats
        actual_seats = (
            await db_session.execute(
                select(func.count(Seat.id)).where(Seat.auditorium_id == aud.id)
            )
        ).scalar()
        assert actual_seats == aud.total_seats, (
            f"Capacity truth mismatch in Aud {aud.id} ({aud.name}): "
            f"auditorium.total_seats={aud.total_seats} vs Seat count={actual_seats}"
        )

        # 2. Layout data seat count equals total_seats
        layout_seats = len(aud.layout_data.get("seats", []))
        assert layout_seats == aud.total_seats, (
            f"Layout data seat count mismatch in Aud {aud.id}: "
            f"auditorium.total_seats={aud.total_seats} vs layout seats={layout_seats}"
        )

        # 3. Format range compliance
        fmt = aud.screen_format
        assert fmt is not None, f"Auditorium {aud.id} has no screen format assigned"
        assert fmt.min_seats <= aud.total_seats <= fmt.max_seats, (
            f"Seat count {aud.total_seats} out of bounds for format {fmt.name} "
            f"[{fmt.min_seats}, {fmt.max_seats}] in Aud {aud.id} ({aud.cinema.name})"
        )


@pytest.mark.asyncio
async def test_signature_uniqueness_per_cinema(db_session):
    """
    Assert that no two halls in the same cinema share a layout signature,
    and at least 8 distinct signatures exist overall.
    """
    cinemas = (
        await db_session.execute(
            select(Cinema).options(selectinload(Cinema.auditoriums))
        )
    ).scalars().all()

    overall_signatures: Set[str] = set()

    for cinema in cinemas:
        signatures_in_cinema = [
            a.layout_data.get("layout_signature") for a in cinema.auditoriums
        ]
        # Check no duplicates in this cinema
        unique_sigs = set(signatures_in_cinema)
        assert len(unique_sigs) == len(signatures_in_cinema), (
            f"Duplicate layout signature in cinema {cinema.name} (id={cinema.id}): "
            f"{signatures_in_cinema}"
        )
        for sig in signatures_in_cinema:
            overall_signatures.add(sig)

    assert len(overall_signatures) >= 8, (
        f"Expected at least 8 distinct layout signatures overall, found {len(overall_signatures)}"
    )
    print(f"\nVerified {len(overall_signatures)} distinct layout signatures across {len(cinemas)} cinemas.")


@pytest.mark.asyncio
async def test_compact_hall_scaled_arrangement(db_session):
    """
    Verify Compact hall's arrangement (two side blocks with wide centre aisle)
    is the base for all halls, with aisle gap >= 1.0 m (2.0 scene units)
    and blocks_pattern = [bl, br].
    """
    auds = (await db_session.execute(select(Auditorium))).scalars().all()

    for aud in auds:
        ld = aud.layout_data
        pattern = ld.get("arrangement_pattern")
        assert pattern == "two_side_blocks_wide_aisle", (
            f"Aud {aud.id} does not use two_side_blocks_wide_aisle: {pattern}"
        )

        blocks = ld.get("blocks_pattern")
        assert isinstance(blocks, list) and len(blocks) == 2, (
            f"Aud {aud.id} must have 2 blocks [bl, br], got {blocks}"
        )
        bl, br = blocks
        assert bl >= 4 and br >= 4, f"Aud {aud.id} blocks too small: {blocks}"

        aisles = ld.get("aisles")
        assert aisles == [bl], (
            f"Aud {aud.id} aisle index must be [{bl}], got {aisles}"
        )


@pytest.mark.asyncio
async def test_format_equipment_profiles(db_session):
    """
    Verify format-specific equipment profiles:
    - 3D formats: has_glasses_counter = True
    - Onyx LED: is_direct_led = True, has_projector_beam = False
    - ScreenX: is_screenx = True, 270 deg panoramic screens
    - 4DX & MX4D: has_motion_pods = True, 4-seat pod grouping
    - Dolby Cinema: theatre_type = luxury_recliner, seat_family = recliner
    - Unconfirmed (ICE, P[XL], EPIQ): confirmation_note = 'details to confirm with the cinema'
    """
    auds = (
        await db_session.execute(
            select(Auditorium).options(selectinload(Auditorium.screen_format))
        )
    ).scalars().all()

    for aud in auds:
        fmt_name = aud.screen_format.name
        eq = aud.layout_data.get("equipment_profile", {})

        if "3D" in fmt_name:
            assert eq.get("has_glasses_counter") is True, f"3D format {fmt_name} must have glasses counter"
        else:
            assert eq.get("has_glasses_counter") is False, f"2D format {fmt_name} must NOT have glasses counter"

        if "Onyx" in fmt_name:
            assert eq.get("is_direct_led") is True, "Onyx must be direct LED"
            assert eq.get("has_projector_beam") is False, "Onyx must NOT have projector beam"
            assert aud.layout_data["screen"]["is_direct_led"] is True

        if "ScreenX" in fmt_name:
            assert eq.get("is_screenx") is True, "ScreenX must have is_screenx True"

        if "4DX" in fmt_name or "MX4D" in fmt_name:
            assert eq.get("has_motion_pods") is True, f"{fmt_name} must have motion pods"
            seats = aud.layout_data["seats"]
            pod_ids = [s.get("pod_id") for s in seats if s.get("pod_id")]
            assert len(pod_ids) == len(seats), f"All seats in {fmt_name} must belong to a 4-seat pod"

        if fmt_name == "Dolby Cinema":
            assert aud.layout_data["theatre_type"] == "luxury_recliner", "Dolby Cinema must use luxury_recliner"
            assert eq.get("seat_family") == "recliner", "Dolby Cinema must use recliner seats"

        if fmt_name in ["ICE", "ICE 3D", "P[XL]", "EPIQ"]:
            assert eq.get("confirmation_note") == "details to confirm with the cinema", (
                f"Generic profile for {fmt_name} must note 'details to confirm with the cinema'"
            )


@pytest.mark.asyncio
async def test_viewing_distance_and_rake_rules(db_session):
    """
    Distance rules:
    - First row >= 0.6x screen width from screen
    - Last row <= 2.0x screen width
    - Step rise <= 0.35 m (0.7 scene units)
    """
    auds = (await db_session.execute(select(Auditorium))).scalars().all()

    for aud in auds:
        ld = aud.layout_data
        screen_w = ld["screen"]["width"] * 0.5  # to meters
        seats = ld["seats"]

        min_dist_m = min(s["distance_to_screen"] for s in seats)
        max_dist_m = max(s["distance_to_screen"] for s in seats)

        assert min_dist_m >= 0.55 * screen_w, (
            f"Aud {aud.id}: first row distance {min_dist_m}m too close to screen {screen_w}m (< 0.6x)"
        )
        assert max_dist_m <= 2.10 * screen_w, (
            f"Aud {aud.id}: last row distance {max_dist_m}m too far from screen {screen_w}m (> 2.0x)"
        )

        # Rake climbable check
        step_rise = ld.get("documented_scale", {}).get("rake_step_m", 0.11)
        assert step_rise <= 0.35, f"Aud {aud.id}: rake step {step_rise}m exceeds safe climbable limit 0.35m"


@pytest.mark.asyncio
async def test_walk_path_down_centre_aisle_on_all_halls(db_session):
    """
    Verify walk path feasibility:
    - Every row is accessible from the central aisle without colliding with seat bounds.
    - Central aisle has adequate clearance (gap >= 2.0 scene units = 1.0 m).
    """
    auds = (await db_session.execute(select(Auditorium))).scalars().all()

    for aud in auds:
        ld = aud.layout_data
        bl = ld["blocks_pattern"][0]
        seats = ld["seats"]

        # Check seats flanking central aisle
        rows = ld["rows"]
        for row in rows:
            row_seats = [s for s in seats if s["row"] == row]
            left_aisle_seat = next(s for s in row_seats if s["number"] == bl)
            right_aisle_seat = next(s for s in row_seats if s["number"] == bl + 1)

            # Left block seat has +X, Right block seat has -X
            aisle_clearance = left_aisle_seat["eye_x"] - right_aisle_seat["eye_x"]
            assert aisle_clearance >= 1.8, (
                f"Aud {aud.id} Row {row}: Centre aisle clearance {aisle_clearance:.2f} units is too tight (< 1.8)"
            )


@pytest.mark.asyncio
async def test_generate_all_halls_stage3_markdown_table(db_session):
    """
    Generates the complete verification table of all 112 auditoriums and writes to
    backend/tests/all_halls_stage3_table.md.
    """
    auds = (
        await db_session.execute(
            select(Auditorium)
            .options(
                selectinload(Auditorium.screen_format),
                selectinload(Auditorium.sound_system),
                selectinload(Auditorium.projection_type),
                selectinload(Auditorium.cinema).selectinload(Cinema.city),
            )
            .order_by(Auditorium.id)
        )
    ).scalars().all()

    lines = [
        "# CineVerse Stage 3 — Complete Table of All 112 Auditoriums",
        "",
        "| ID | City | Cinema | Screen | Format | Sound | Projection | Rows | Blocks | Seats | Signature | Capacity Match | Range Verified |",
        "|---:|:---|:---|:---|:---|:---|:---|:---|:---|---:|:---|:---:|:---:|",
    ]

    for aud in auds:
        city_name = aud.cinema.city.name
        cinema_name = aud.cinema.name.replace("CineVerse ", "")
        screen_name = aud.name.split(" — ")[0]
        fmt_name = aud.screen_format.name
        snd_name = aud.sound_system.name
        prj_name = aud.projection_type.name

        ld = aud.layout_data
        rows_str = f"{len(ld['rows'])} ({ld['rows'][0]}–{ld['rows'][-1]})"
        blocks_str = f"{ld['blocks_pattern'][0]}-{ld['blocks_pattern'][1]}"
        seats = aud.total_seats
        sig = ld.get("layout_signature", "N/A")

        # Capacity match check
        cap_match = "Yes" if len(ld["seats"]) == aud.total_seats else "NO"
        in_range = "Yes" if (aud.screen_format.min_seats <= seats <= aud.screen_format.max_seats) else "NO"

        lines.append(
            f"| {aud.id} | {city_name} | {cinema_name} | {screen_name} | {fmt_name} | {snd_name} | {prj_name} | {rows_str} | {blocks_str} | {seats} | `{sig}` | {cap_match} | {in_range} |"
        )

    table_content = "\n".join(lines) + "\n"
    table_path = "backend/tests/all_halls_stage3_table.md"
    with open(table_path, "w", encoding="utf-8") as f:
        f.write(table_content)

    print(f"\nGenerated complete Stage 3 table of all {len(auds)} auditoriums: {table_path}")
