/**
 * Builds the standard 2D seat-map grid from the SAME seat records the 3D scene uses.
 * Screen is at the top; rows A (front) to J (back) top to bottom; within a row seats run
 * left to right as seen by the audience (seat 01 on the audience left).
 *
 * In glTF Y-up world coordinates facing +Z toward screen:
 * - Audience sits along -Z facing +Z
 * - Viewer's left is -X (seat 01 is at -6.0)
 * - Viewer's right is +X (seat 10 is at +6.0)
 * Therefore sorting ascending by X (-6.0 -> +6.0) arranges seats 01 -> 10 left-to-right.
 *
 * Aisle gaps and category bands are detected directly from geometry.
 */
export interface LayoutSeat {
  seat_id: string;
  row: string;
  number: number;
  position_gltf_y_up: [number, number, number];
  category: string;
  seat_type?: string;
  pair_partner_id?: string;
  level?: 'stalls' | 'balcony';
  section?: string;
  in_motion_zone?: boolean;
}

export interface MapSeat {
  seat_id: string;
  number: number;
  col: number;
  category: string;
  x: number;
  seat_type?: string;
  pair_partner_id?: string;
  level?: 'stalls' | 'balcony';
  section?: string;
  in_motion_zone?: boolean;
}

export interface MapRow {
  row: string;
  z: number;
  seats: MapSeat[];
}

export interface SeatMapLayout {
  rows: MapRow[];
  cols: number;
  aisleAfterCols: number[];
  categoryBands: { category: string; rows: string[] }[];
}

export function buildSeatMapLayout(seats: LayoutSeat[]): SeatMapLayout {
  const byRow = new Map<string, LayoutSeat[]>();
  for (const s of seats) {
    (byRow.get(s.row) ?? byRow.set(s.row, []).get(s.row)!).push(s);
  }

  const rows: MapRow[] = [...byRow.entries()].map(([row, list]) => {
    // Audience left is +X (seat 01: +6.0), audience right is -X (seat 10: -6.0).
    // Sort descending by X so seat 01 is on the left (col 0).
    const sorted = [...list].sort((a, b) => b.position_gltf_y_up[0] - a.position_gltf_y_up[0]);
    const z = list.reduce((t, s) => t + s.position_gltf_y_up[2], 0) / list.length;
    return {
      row,
      z,
      seats: sorted.map((s, i) => ({
        seat_id: s.seat_id,
        number: s.number,
        col: i,
        category: s.category,
        x: s.position_gltf_y_up[0],
        seat_type: s.seat_type,
        pair_partner_id: s.pair_partner_id,
        level: s.level,
        section: s.section,
        in_motion_zone: s.in_motion_zone,
      }))
    };
  }).sort((a, b) => b.z - a.z); // larger z = closer to screen (Row A z~-8) = top of map

  // Aisle detection = gap noticeably larger than normal seat pitch
  const gaps = new Set<number>();
  for (const r of rows) {
    const xs = r.seats.map((s) => s.x);
    const pitches = xs.slice(1).map((x, i) => Math.abs(xs[i] - x));
    const typical = [...pitches].sort((a, b) => a - b)[Math.floor(pitches.length / 2)];
    pitches.forEach((p, i) => {
      if (p > typical * 1.5) gaps.add(i);
    });
  }

  const bands: { category: string; rows: string[] }[] = [];
  for (const r of rows) {
    const cat = r.seats[0].category;
    const last = bands[bands.length - 1];
    if (last && last.category === cat) {
      last.rows.push(r.row);
    } else {
      bands.push({ category: cat, rows: [r.row] });
    }
  }

  return {
    rows,
    cols: Math.max(...rows.map((r) => r.seats.length)),
    aisleAfterCols: [...gaps].sort((a, b) => a - b),
    categoryBands: bands
  };
}
