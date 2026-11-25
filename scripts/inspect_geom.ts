import { generateProceduralAuditorium } from '../frontend/lib/proceduralAuditorium';

async function test() {
  for (const id of [1875, 737, 732]) {
    const res = await fetch('http://127.0.0.1:8000/api/v1/showtimes/' + id + '/seats');
    const data = await res.json();
    const result = generateProceduralAuditorium({
      ...data.layout_data,
      screen_type: data.screen_type,
      total_seats: data.seats.length,
    });
    console.log('=== ID', id, data.auditorium_name, data.screen_type, '===');
    console.log('geometry.dimensions:', result.geometry.dimensions);
    const seats = result.seatLayout.seats;
    let minX = 999, maxX = -999, minY = 999, maxY = -999, minZ = 999, maxZ = -999;
    seats.forEach(s => {
      const b = s.bounds_gltf_y_up;
      minX = Math.min(minX, b.min[0], b.max[0]);
      maxX = Math.max(maxX, b.min[0], b.max[0]);
      minY = Math.min(minY, b.min[1], b.max[1]);
      maxY = Math.max(maxY, b.min[1], b.max[1]);
      minZ = Math.min(minZ, b.min[2], b.max[2]);
      maxZ = Math.max(maxZ, b.min[2], b.max[2]);
    });
    console.log('Seats bounds: X:', minX.toFixed(1), 'to', maxX.toFixed(1), 'Y:', minY.toFixed(1), 'to', maxY.toFixed(1), 'Z:', minZ.toFixed(1), 'to', maxZ.toFixed(1));
  }
}
test();
