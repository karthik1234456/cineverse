"""migrate dolby_atmos_4dx to motion_seat

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-11-13 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = '9c0d1e2f3a4b'
down_revision = '8b9c0d1e2f3a'
branch_labels = None
depends_on = None


def upgrade():
    # Update layout_data in auditoriums where theatre_type is 'dolby_atmos_4dx'
    conn = op.get_bind()
    res = conn.execute(sa.text("SELECT id, layout_data, screen_type FROM auditoriums"))
    for row in res.fetchall():
        aud_id, ldata, stype = row[0], row[1], row[2]
        if ldata:
            if isinstance(ldata, str):
                try:
                    ldata = json.loads(ldata)
                except Exception:
                    continue
            changed = False
            if ldata.get("theatre_type") == "dolby_atmos_4dx":
                ldata["theatre_type"] = "motion_seat"
                changed = True
            if ldata.get("layout_signature") == "dolby_atmos_4dx":
                ldata["layout_signature"] = "motion_pods"
                changed = True
            if changed:
                conn.execute(
                    sa.text("UPDATE auditoriums SET layout_data = :ldata WHERE id = :id"),
                    {"ldata": json.dumps(ldata) if isinstance(row[1], str) else ldata, "id": aud_id}
                )


def downgrade():
    conn = op.get_bind()
    res = conn.execute(sa.text("SELECT id, layout_data FROM auditoriums"))
    for row in res.fetchall():
        aud_id, ldata = row[0], row[1]
        if ldata:
            if isinstance(ldata, str):
                try:
                    ldata = json.loads(ldata)
                except Exception:
                    continue
            if ldata.get("theatre_type") == "motion_seat":
                ldata["theatre_type"] = "dolby_atmos_4dx"
                conn.execute(
                    sa.text("UPDATE auditoriums SET layout_data = :ldata WHERE id = :id"),
                    {"ldata": json.dumps(ldata) if isinstance(row[1], str) else ldata, "id": aud_id}
                )

