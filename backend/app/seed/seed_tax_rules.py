# backend/app/seed/seed_tax_rules.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.tax import TaxRule, TaxEntity, TaxSetting
from app.models.cinema import Cinema, City


async def seed_tax_system():
    print("--- Seeding Tax Rules & Entities ---")
    from app.database import init_db
    await init_db()
    async with AsyncSessionLocal() as db:
        # 1. Seed Tax Settings
        setting_res = await db.execute(select(TaxSetting).limit(1))
        setting = setting_res.scalars().first()
        if not setting:
            setting = TaxSetting(
                ticket_supplier_model="CINEMA",
                convenience_fee_supplier_model="PLATFORM",
                rounding_mode="HALF_UP",
                notes="Placeholder - to be confirmed by a chartered accountant (see docs/tax-open-questions.md)"
            )
            db.add(setting)
            print("Created default TaxSetting (Cinema issues tickets, Platform issues convenience fee).")

        # 2. Seed Effective-Dated Tax Rules (PLACEHOLDERS, UNCONFIRMED)
        existing_rules = await db.execute(select(TaxRule))
        rules_list = existing_rules.scalars().all()
        start_date = datetime(2024, 1, 1)
        if not rules_list:
            rules = [
                TaxRule(
                    item_type="TICKET",
                    sac_hsn_code="999612",
                    description="Admission to exhibition of cinematographic films (Ticket value up to ₹100)",
                    rate_percent=12.0,
                    min_price_paise=0,
                    max_price_paise=10000,
                    valid_from=start_date,
                    valid_to=None,
                    is_active=True,
                    is_confirmed_by_ca=False,
                    confirmation_notes="to be confirmed by a chartered accountant — Provisional 12% GST under SAC 999612 for tickets <= ₹100"
                ),
                TaxRule(
                    item_type="TICKET",
                    sac_hsn_code="999613",
                    description="Admission to exhibition of cinematographic films (Ticket value exceeding ₹100)",
                    rate_percent=18.0,
                    min_price_paise=10001,
                    max_price_paise=None,
                    valid_from=start_date,
                    valid_to=None,
                    is_active=True,
                    is_confirmed_by_ca=False,
                    confirmation_notes="to be confirmed by a chartered accountant — Provisional 18% GST under SAC 999613 for tickets > ₹100"
                ),
                TaxRule(
                    item_type="CONVENIENCE_FEE",
                    sac_hsn_code="998599",
                    description="Online booking convenience fee & digital platform facilitation services",
                    rate_percent=18.0,
                    min_price_paise=0,
                    max_price_paise=None,
                    valid_from=start_date,
                    valid_to=None,
                    is_active=True,
                    is_confirmed_by_ca=False,
                    confirmation_notes="to be confirmed by a chartered accountant — Provisional 18% GST under SAC 998599 for digital facilitation"
                ),
                TaxRule(
                    item_type="FOOD_BEVERAGE",
                    sac_hsn_code="996331",
                    description="Food and beverage served in cinema hall / concession counters without ITC",
                    rate_percent=5.0,
                    min_price_paise=0,
                    max_price_paise=None,
                    valid_from=start_date,
                    valid_to=None,
                    is_active=True,
                    is_confirmed_by_ca=False,
                    confirmation_notes="to be confirmed by a chartered accountant — Provisional 5% GST without input tax credit for cinema F&B"
                ),
            ]
            for r in rules:
                db.add(r)
            print(f"Seeded {len(rules)} placeholder tax rules (all marked is_confirmed_by_ca=False).")
        else:
            for r in rules_list:
                r.valid_from = start_date
            print(f"Updated {len(rules_list)} rules valid_from to {start_date.isoformat()}.")

        # 3. Seed Platform Tax Entity
        plat_res = await db.execute(select(TaxEntity).where(TaxEntity.entity_type == "PLATFORM"))
        platform_entity = plat_res.scalars().first()
        if not platform_entity:
            platform_entity = TaxEntity(
                entity_type="PLATFORM",
                cinema_id=None,
                legal_name="CineVerse Digital Private Limited",
                trade_name="CineVerse",
                gstin="36AABCC1234D1Z5",
                pan="AABCC1234D",
                cin="U72900TG2026PTC198822",
                registered_address="Building 12, Mindspace Madhapur, HITEC City",
                city="Hyderabad",
                state="Telangana",
                state_code="36",
                pincode="500081",
                email="tax-compliance@cineverse.com",
                phone="+91 40 6800 5500",
                is_active=True
            )
            db.add(platform_entity)
            print("Seeded Platform Tax Entity (Telangana 36AABCC1234D1Z5).")

        # 4. Seed Cinema Tax Entities for key cinemas
        cinemas_res = await db.execute(select(Cinema))
        cinemas = cinemas_res.scalars().all()
        for cin in cinemas[:10]:
            c_ent_res = await db.execute(select(TaxEntity).where(TaxEntity.cinema_id == cin.id))
            if not c_ent_res.scalars().first():
                await db.refresh(cin, ["city"])
                st_name = cin.city.state if (cin.city and cin.city.state) else "Telangana"
                from app.services.tax_invoice_service import lookup_state_code
                st_code = lookup_state_code(st_name)
                c_ent = TaxEntity(
                    entity_type="CINEMA",
                    cinema_id=cin.id,
                    legal_name=f"{cin.name} Theatres Private Limited",
                    trade_name=cin.name,
                    gstin=f"{st_code}AABCP{cin.id:04d}C1Z8",
                    pan=f"AABCP{cin.id:04d}C",
                    registered_address=cin.address,
                    city=cin.city.name if cin.city else "Hyderabad",
                    state=st_name,
                    state_code=st_code,
                    pincode=cin.pincode or "500081",
                    email=f"compliance.cinema{cin.id}@cineverse.cinemas.in",
                    phone=cin.phone or "+91 80 4000 1234",
                    is_active=True
                )
                db.add(c_ent)
        print("Cinema tax entities checked and seeded.")

        await db.commit()
    print("Tax system seeding complete!")


if __name__ == '__main__':
    asyncio.run(seed_tax_system())
