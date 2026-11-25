import { generateProceduralAuditorium } from '../lib/proceduralAuditorium';
import { THEATRE_TYPE_REGISTRY, SCENE_TO_METERS } from '../lib/theatreTypeRegistry';

interface GeometryReportItem {
  id: string;
  name: string;
  screenType: string;
  screenWidthM: number;
  screenHeightM: number;
  stageDepthM: number;
  distToRowAM: number;
  distRatio: number;
  emptyFloorM: number;
  frontRowFovDeg: number;
  backRowFovDeg: number;
}

const hallTypes = [
  'compact',
  'standard',
  'large',
  'flagship',
  'motion_seat',
  'dolby_atmos_4dx',
  'luxury_recliner',
  'boutique',
  'balcony',
];

const results: GeometryReportItem[] = [];

hallTypes.forEach((tid) => {
  const rows = tid === 'boutique' ? 6 : tid === 'luxury_recliner' ? 8 : 10;
  const res = generateProceduralAuditorium({
    theatre_type: tid,
    rows,
    seats_per_row: 14,
    is_motion_hall: tid === 'motion_seat' || tid === 'dolby_atmos_4dx',
  });

  const screen = res.seatLayout.screen;
  const screenWidthM = Math.round(screen.width * SCENE_TO_METERS * 100) / 100;
  const screenHeightM = Math.round(screen.height * SCENE_TO_METERS * 100) / 100;
  const screenZ = screen.center_gltf_y_up[2];

  const rowASeats = res.seatLayout.seats.filter((s) => s.row === 'A');
  const rowAZ = rowASeats[0].position_gltf_y_up[2];
  const distToRowAM = Math.round(Math.abs(rowAZ - screenZ) * SCENE_TO_METERS * 100) / 100;
  const distRatio = Math.round((distToRowAM / screenWidthM) * 100) / 100;

  const stageLip = res.geometry.stageLip;
  const stageDepthM = Math.round(Math.abs(stageLip.max[2] - stageLip.min[2]) * SCENE_TO_METERS * 100) / 100;
  const stageFrontEdgeZ = stageLip.min[2];
  const emptyFloorM = Math.round(Math.abs(rowAZ - stageFrontEdgeZ) * SCENE_TO_METERS * 100) / 100;

  const frontRowFovDeg = Math.round((2 * Math.atan((screenWidthM / 2) / distToRowAM) * 180 / Math.PI) * 10) / 10;

  const allRows = Array.from(new Set(res.seatLayout.seats.map((s) => s.row))).sort();
  const backRow = allRows[allRows.length - 1];
  const backRowSeats = res.seatLayout.seats.filter((s) => s.row === backRow);
  const backRowZ = backRowSeats[0].position_gltf_y_up[2];
  const distToBackRowM = Math.abs(backRowZ - screenZ) * SCENE_TO_METERS;
  const backRowFovDeg = Math.round((2 * Math.atan((screenWidthM / 2) / distToBackRowM) * 180 / Math.PI) * 10) / 10;

  const reg = (THEATRE_TYPE_REGISTRY as Record<string, any>)[tid];
  results.push({
    id: tid,
    name: reg?.name || tid,
    screenType: reg?.screenType?.name || 'Standard',
    screenWidthM,
    screenHeightM,
    stageDepthM,
    distToRowAM,
    distRatio,
    emptyFloorM,
    frontRowFovDeg,
    backRowFovDeg,
  });
});

console.log(JSON.stringify(results, null, 2));
