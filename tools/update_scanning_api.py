with open("backend/app/api/v1/operations/scanning.py", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update import
target_import = "from app.services.ticket_service import verify_ticket_signature"
new_import = "from app.services.ticket_service import verify_ticket_signature, get_public_keys"
assert target_import in text
text = text.replace(target_import, new_import, 1)

# 2. Add GET /keys endpoint before register_staff_device
keys_endpoint = """@router.get("/keys")
async def get_verification_keys(
    current_user: User = Depends(require_user)
):
    \"\"\"
    Returns public keys and key IDs (`kid`) for offline scanning devices.
    Staff devices download and cache these keys periodically to perform offline Ed25519
    signature verification without exposing server private keys.
    \"\"\"
    return {"status": "ok", "keys": get_public_keys()}


"""
target_reg = "@router.post(\"/devices/register\")"
assert target_reg in text
text = text.replace(target_reg, keys_endpoint + target_reg, 1)

# 3. Update batch_sync_offline_scans to log duplicate conflicts
old_batch = """        if ticket.is_used:
            results.append({
                "client_scan_id": item.client_scan_id,
                "result": "ALREADY_USED",
                "used_at": ticket.used_at.isoformat() if ticket.used_at else None
            })
            continue"""

new_batch = """        if ticket.is_used:
            # Reconcile conflict: duplicate offline scan detected across devices
            conflict_log = TicketScanLog(
                ticket_id=ticket.id,
                staff_user_id=current_user.id,
                device_id=item.device_id,
                gate=item.gate,
                scan_result=ScanResultEnum.OFFLINE_DUPLICATE_CONFLICT,
                scanned_at=item.scanned_at,
                offline_sync=True
            )
            db.add(conflict_log)
            results.append({
                "client_scan_id": item.client_scan_id,
                "result": "OFFLINE_DUPLICATE_CONFLICT",
                "message": "Ticket already used/admitted by an earlier scan",
                "used_at": ticket.used_at.isoformat() if ticket.used_at else None
            })
            continue"""

assert old_batch in text
text = text.replace(old_batch, new_batch, 1)

with open("backend/app/api/v1/operations/scanning.py", "w", encoding="utf-8") as f:
    f.write(text)
print("scanning.py updated successfully")

