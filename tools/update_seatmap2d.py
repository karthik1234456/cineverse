with open("frontend/components/2d/SeatMap2D.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add import of buildSeatMapLayout
target_import = "import layoutData from '@/public/models/seat_layout_v2.json';"
new_import = "import layoutData from '@/public/models/seat_layout_v2.json';\nimport { buildSeatMapLayout } from '@/lib/seatMapLayout';"
assert target_import in text
text = text.replace(target_import, new_import, 1)

# 2. Use buildSeatMapLayout for layout computation
old_layout_block = """  // Layout parsing
  const seatsList = useMemo(() => (layoutData as unknown as SeatLayoutFile).seats || [], []);
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seatsList) {
      map.set(s.seat_id, s);
    }
    return map;
  }, [seatsList]);

  // Group seats by rows: J to A
  const rows = useMemo(() => ['J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'], []);
  const rowSeats = useMemo(() => {
    const map: Record<string, SeatRecord[]> = {};
    for (const r of rows) map[r] = [];
    for (const s of seatsList) {
      const r = s.seat_id[0];
      if (map[r]) map[r].push(s);
    }
    for (const r of rows) {
      map[r].sort((a, b) => a.number - b.number);
    }
    return map;
  }, [seatsList, rows]);"""

new_layout_block = """  // Layout parsing via authoritative geometric seatMapLayout
  const seatsList = useMemo(() => (layoutData as unknown as SeatLayoutFile).seats || [], []);
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seatsList) {
      map.set(s.seat_id, s);
    }
    return map;
  }, [seatsList]);

  // Derive geometric layout: seat 01 on audience left, aisle gap detection
  const layout2D = useMemo(() => {
    return buildSeatMapLayout(seatsList as any);
  }, [seatsList]);

  // Group seats by rows: J (back) to A (front)
  const rows = useMemo(() => ['J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'], []);
  const rowSeats = useMemo(() => {
    const map: Record<string, SeatRecord[]> = {};
    for (const r of rows) map[r] = [];
    // Populate rows based on geometry from layout2D
    for (const mapRow of layout2D.rows) {
      const r = mapRow.row;
      map[r] = mapRow.seats.map((ms) => seatMap.get(ms.seat_id)!).filter(Boolean);
    }
    return map;
  }, [layout2D, seatMap, rows]);"""

assert old_layout_block in text
text = text.replace(old_layout_block, new_layout_block, 1)

with open("frontend/components/2d/SeatMap2D.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("SeatMap2D.tsx updated successfully")

