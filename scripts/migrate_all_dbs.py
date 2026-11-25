import sqlite3
import glob

for path in glob.glob('*.db') + glob.glob('backend/*.db'):
    try:
        conn = sqlite3.connect(path)
        c = conn.cursor()
        
        # Showtimes
        c.execute("PRAGMA table_info(showtimes)")
        cols = [r[1] for r in c.fetchall()]
        if 'status' not in cols:
            c.execute("ALTER TABLE showtimes ADD COLUMN status VARCHAR(20) DEFAULT 'SCHEDULED'")
        if 'cancellation_reason' not in cols:
            c.execute("ALTER TABLE showtimes ADD COLUMN cancellation_reason VARCHAR(255)")
        if 'cleaning_gap_minutes' not in cols:
            c.execute("ALTER TABLE showtimes ADD COLUMN cleaning_gap_minutes INTEGER DEFAULT 20")
        if 'import_batch_id' not in cols:
            c.execute("ALTER TABLE showtimes ADD COLUMN import_batch_id VARCHAR(64)")
            
        # Dynamic pricing rules
        c.execute("PRAGMA table_info(dynamic_pricing_rules)")
        dp_cols = [r[1] for r in c.fetchall()]
        if 'version' not in dp_cols:
            c.execute("ALTER TABLE dynamic_pricing_rules ADD COLUMN version INTEGER DEFAULT 1")
        if 'category' not in dp_cols:
            c.execute("ALTER TABLE dynamic_pricing_rules ADD COLUMN category VARCHAR(50)")
        if 'description' not in dp_cols:
            c.execute("ALTER TABLE dynamic_pricing_rules ADD COLUMN description VARCHAR(255)")

        # Import batches
        c.execute("""
            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id VARCHAR(64) UNIQUE NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                total_rows INTEGER DEFAULT 0,
                valid_rows INTEGER DEFAULT 0,
                invalid_rows INTEGER DEFAULT 0,
                created_by_user_id INTEGER,
                status VARCHAR(20) DEFAULT 'APPLIED',
                created_ids JSON,
                error_report JSON,
                created_at DATETIME,
                undone_at DATETIME
            )
        """)

        conn.commit()
        conn.close()
        print(f"Migrated {path}")
    except Exception as e:
        print(f"Error migrating {path}: {e}")
