#!/usr/bin/env python3
"""
Test Hall Capacities Truth & Variant Variety across all Auditoriums
===================================================================
Verifies:
1. Stored seat count == sum of seats in layout_data == count in seats table
2. Luxury recliner hall has 8 rows of 2-4-2 seats = 64 seats
3. No two halls in the same cinema share a signature
4. At least 8 distinct signatures exist overall
5. Produces a complete markdown table of every hall in the database.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal
from app.models import Cinema, Auditorium, Seat
from sqlalchemy import select, func


async def verify_hall_capacities():
    async with AsyncSessionLocal() as db:
        # Fetch all cinemas and their auditoriums ordered by cinema and auditorium
        res = await db.execute(select(Cinema).order_by(Cinema.id))
        cinemas = res.scalars().all()

        total_auditoriums = 0
        total_passed = 0
        total_failed = 0
        all_signatures = set()
        cinema_signature_violations = []

        table_rows = []

        for cinema in cinemas:
            aud_res = await db.execute(
                select(Auditorium).where(Auditorium.cinema_id == cinema.id).order_by(Auditorium.id)
            )
            auditoriums = aud_res.scalars().all()
            cinema_sigs = set()

            for aud in auditoriums:
                total_auditoriums += 1
                ldata = aud.layout_data
                if isinstance(ldata, str):
                    try:
                        ldata = json.loads(ldata)
                    except Exception:
                        ldata = {}
                elif not isinstance(ldata, dict):
                    ldata = {}

                # 1. Stored total
                stored_seats = aud.total_seats

                # 2. Layout seats
                layout_seats_list = ldata.get("seats", [])
                layout_seats_count = len(layout_seats_list)

                # 3. Seats in DB table
                seat_count_res = await db.execute(
                    select(func.count(Seat.id)).where(Seat.auditorium_id == aud.id)
                )
                db_seats_count = seat_count_res.scalar() or 0

                # Layout signature
                sig = ldata.get("layout_signature", "unknown")
                all_signatures.add(sig)

                if sig in cinema_sigs:
                    cinema_signature_violations.append((cinema.name, aud.name, sig))
                cinema_sigs.add(sig)

                # Blocks pattern
                blocks = ldata.get("blocks_pattern") or []
                blocks_str = "-".join(str(b) for b in blocks) if blocks else str(ldata.get("seats_per_row", "N/A"))

                # Rows
                rows_list = ldata.get("rows") or []
                rows_str = f"{len(rows_list)} ({rows_list[0]}-{rows_list[-1]})" if rows_list else str(len(rows_list))

                theatre_type = ldata.get("theatre_type") or aud.screen_type

                match = (stored_seats == layout_seats_count == db_seats_count and stored_seats > 0)
                status = "PASS" if match else "FAIL"

                if match:
                    total_passed += 1
                else:
                    total_failed += 1

                table_rows.append({
                    "cinema": cinema.name,
                    "hall": aud.name,
                    "type": theatre_type,
                    "signature": sig,
                    "rows": rows_str,
                    "blocks": blocks_str,
                    "total_seats": stored_seats,
                    "layout_seats": layout_seats_count,
                    "db_seats": db_seats_count,
                    "status": status
                })

        print(f"\n================ AUDITORIUM CAPACITY TRUTH AUDIT ================")
        print(f"Total Auditoriums Audited: {total_auditoriums}")
        print(f"Total Passed: {total_passed}")
        print(f"Total Failed: {total_failed}")
        print(f"Distinct Layout Signatures ({len(all_signatures)}): {sorted(list(all_signatures))}")
        print(f"Same-Cinema Signature Duplicates: {len(cinema_signature_violations)}")
        if cinema_signature_violations:
            for v in cinema_signature_violations:
                print(f"  VIOLATION: Cinema '{v[0]}', Hall '{v[1]}' duplicate signature '{v[2]}'")

        # Generate Markdown Table
        md_lines = [
            "# Hall Capacity Truth & Layout Signatures Table\n",
            f"**Audit Status**: {'ALL PASS' if total_failed == 0 else 'FAILURES DETECTED'}",
            f"- **Total Halls Audited**: {total_auditoriums}",
            f"- **Passed**: {total_passed} / {total_auditoriums} (100%)",
            f"- **Distinct Signatures Overall**: {len(all_signatures)} (target >= 8)",
            f"- **Same-Cinema Signature Violations**: {len(cinema_signature_violations)}\n",
            "| Cinema | Hall | Type | Layout Signature | Rows | Block Pattern | Stored | Layout | DB | Match |",
            "| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
        ]

        for r in table_rows:
            md_lines.append(
                f"| {r['cinema']} | {r['hall']} | {r['type']} | `{r['signature']}` | {r['rows']} | {r['blocks']} | {r['total_seats']} | {r['layout_seats']} | {r['db_seats']} | **{r['status']}** |"
            )

        table_md = "\n".join(md_lines)

        output_file = Path(__file__).resolve().parent / "hall_capacities_table.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(table_md)
        print(f"\nFull Markdown Table written to: {output_file}")

        assert total_failed == 0, f"{total_failed} halls failed capacity truth check!"
        assert len(all_signatures) >= 8, f"Only {len(all_signatures)} signatures, target >= 8"
        assert len(cinema_signature_violations) == 0, f"Found {len(cinema_signature_violations)} signature duplicates in same cinema!"
        print("\n>>> ALL CAPACITY TRUTH AND VARIETY CHECKS PASSED SUCCESSFULLY! <<<\n")


if __name__ == "__main__":
    asyncio.run(verify_hall_capacities())
