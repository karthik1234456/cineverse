/**
 * Builds the standard 2D seat-map grid from the SAME seat records the 3D scene uses.
 * Screen is at the top; rows A (front) to J (back) top to bottom; within a row seats run
 * left to right as seen by the audience (seat 01 on the left, +X). Aisle gaps are detected from data.
 */
export interface LayoutSeat { seat_id: string; row: string; number: number; position_gltf_y_up: [number, number, number]; category: string }
export interface MapSeat { seat_id: string; number: number; col: number; category: string; x: number }
export interface MapRow { row: string; seats: MapSeat[]; z: number }
export interface SeatMapLayout { rows: MapRow[]; cols: number; aisleAfterCols: number[]; categoryBands: { category: string; rows: string[] }[] }

export function buildSeatMapLayout(seats: LayoutSeat[]): SeatMapLayout {
  const byRow = new Map<string, LayoutSeat[]>();
  for (const s of seats) (byRow.get(s.row) ?? byRow.set(s.row, []).get(s.row)!).push(s);
  const rows: MapRow[] = [...byRow.entries()].map(([row, list]) => {
    const sorted = [...list].sort((a, b) => b.position_gltf_y_up[0] - a.position_gltf_y_up[0]); // +X is audience-left
    const z = list.reduce((t, s) => t + s.position_gltf_y_up[2], 0) / list.length;
    return { row, z, seats: sorted.map((s, i) => ({ seat_id: s.seat_id, number: s.number, col: i, category: s.category, x: s.position_gltf_y_up[0] })) };
  }).sort((a, b) => b.z - a.z); // larger z = closer to the screen = top of the map
  // Aisle = a gap clearly larger than the typical seat pitch, found on any row.
  const gaps = new Set<number>();
  for (const r of rows) {
    const xs = r.seats.map((s) => s.x), pitches = xs.slice(1).map((x, i) => xs[i] - x);
    const typical = [...pitches].sort((a, b) => a - b)[Math.floor(pitches.length / 2)];
    pitches.forEach((p, i) => { if (p > typical * 1.5) gaps.add(i); });
  }
  const bands: { category: string; rows: string[] }[] = [];
  for (const r of rows) {
    const cat = r.seats[0].category, last = bands[bands.length - 1];
    if (last && last.category === cat) last.rows.push(r.row); else bands.push({ category: cat, rows: [r.row] });
  }
  return { rows, cols: Math.max(...rows.map((r) => r.seats.length)), aisleAfterCols: [...gaps].sort((a, b) => a - b), categoryBands: bands };
}
