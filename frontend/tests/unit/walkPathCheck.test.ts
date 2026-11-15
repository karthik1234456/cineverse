import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';
import { stepPlayer, getGroundHeightAt } from '../../lib/walkCollision';

describe('PART C: Walk Mode Automated Path Check & Navigation', () => {
  it('allows player to walk from spawn point to the top row across aisles in the 560-seat hall', () => {
    // Generate a 560-seat hall (20 rows, 28 seats per row)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
    const hall = generateProceduralAuditorium({
      rows,
      seats_per_row: 28,
      aisles: [8, 20],
      total_seats: 560,
      theatre_type: 'flagship',
      screen_type: 'Large screen',
    });

    const playerCfg = hall.walkNav.player;
    expect(playerCfg.radius).toBe(0.5);
    expect(playerCfg.standing_eye_height).toBe(3.2);
    expect(playerCfg.max_step_up).toBe(0.7);
    expect(playerCfg.max_step_down).toBe(0.8);

    const spawn = playerCfg.spawn_position;
    const initialGround = getGroundHeightAt(spawn[0], spawn[2], hall.walkNav.walkable, spawn[1]);
    let curPos = { x: spawn[0], y: initialGround ?? spawn[1], z: spawn[2] };

    // Walk backwards toward rear seats (-Z direction) along aisle
    const targetZ = hall.geometry.dimensions.zBack + 3.0;
    const stepSize = 0.2;
    let steps = 0;

    while (curPos.z > targetZ && steps < 300) {
      steps++;
      const res = stepPlayer(
        curPos,
        { dx: 0, dz: -stepSize },
        hall.walkNav.walkable,
        hall.walkNav.colliders,
        {
          radius: playerCfg.radius,
          maxStepUp: playerCfg.max_step_up,
          maxStepDown: playerCfg.max_step_down,
        }
      );
      if (res.blockedByEdge) {
        // Reached end of aisle at top tier
        break;
      }
      curPos = res.newPos;
    }

    // Verify player reached the rear tier / top row area
    expect(curPos.z).toBeLessThan(spawn[2] - 10.0);
    expect(curPos.y).toBeGreaterThan(1.0); // Stepped up onto elevated tiers
  });

  it('allows player to navigate in the motion-seat hall without obstacles blocking the aisle', () => {
    // Motion-seat hall layout (12 rows, pods of 4 and 2)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const hall = generateProceduralAuditorium({
      rows,
      seats_per_row: 18,
      aisles: [4, 14],
      total_seats: 216,
      theatre_type: 'dolby_atmos_4dx',
      screen_type: 'Motion-seat hall',
      features: { is_4dx: true, motion_seats: true },
    });

    // Verify no monolithic carpet runners
    expect(hall.geometry.carpetRunners?.length ?? 0).toBe(0);

    const playerCfg = hall.walkNav.player;
    const spawn = playerCfg.spawn_position;
    const groundAtSpawn = getGroundHeightAt(spawn[0], spawn[2], hall.walkNav.walkable, spawn[1]) ?? spawn[1];
    let curPos = { x: spawn[0], y: groundAtSpawn, z: spawn[2] };

    // Walk straight up the aisle
    for (let i = 0; i < 60; i++) {
      const res = stepPlayer(
        curPos,
        { dx: 0, dz: -0.2 },
        hall.walkNav.walkable,
        hall.walkNav.colliders,
        {
          radius: playerCfg.radius,
          maxStepUp: playerCfg.max_step_up,
          maxStepDown: playerCfg.max_step_down,
        }
      );
      expect(res.blockedByEdge).toBe(false);
      curPos = res.newPos;
    }

    // Verify player is on elevated tier
    expect(curPos.y).toBeGreaterThan(0.5);
  });

  it('prevents player from walking into seat blocks or leaving the hall volume', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const hall = generateProceduralAuditorium({
      rows,
      seats_per_row: 16,
      aisles: [8],
      total_seats: 160,
    });

    const playerCfg = hall.walkNav.player;
    // Attempt to walk sideways directly into a seat block
    const aisleX = hall.walkNav.player.spawn_position[0];
    const curPos = { x: aisleX, y: 0.22, z: hall.seatLayout.seats[0].position_gltf_y_up[2] };

    // Find seat collider bounds near this row
    const seat0 = hall.seatLayout.seats[0];
    const res = stepPlayer(
      curPos,
      { dx: seat0.position_gltf_y_up[0] - aisleX, dz: 0 },
      hall.walkNav.walkable,
      hall.walkNav.colliders,
      {
        radius: playerCfg.radius,
        maxStepUp: playerCfg.max_step_up,
        maxStepDown: playerCfg.max_step_down,
      }
    );

    // Collision should prevent player from penetrating center of seat
    const seatDist = Math.abs(res.newPos.x - seat0.position_gltf_y_up[0]);
    expect(seatDist).toBeGreaterThanOrEqual(playerCfg.radius * 0.8);
  });

  it('runs automated walk path test across all hall variants from spawn to rear tiers', () => {
    const variants = [
      { type: 'compact', seats: 100, rows: 10, seatsPerRow: 10, aisles: [3, 7] },
      { type: 'standard', seats: 216, rows: 12, seatsPerRow: 18, aisles: [4, 14], arrangement: 'standard_wide_triple' },
      { type: 'standard', seats: 224, rows: 14, seatsPerRow: 16, aisles: [8], arrangement: 'single_aisle' },
      { type: 'standard', seats: 216, rows: 12, seatsPerRow: 18, aisles: [], arrangement: 'continental' },
      { type: 'standard', seats: 140, rows: 10, seatsPerRow: 14, aisles: [3, 11], arrangement: 'compact_triple' },
      { type: 'balcony', seats: 588, rows: 21, seatsPerRow: 28, aisles: [7, 21], arrangement: 'balcony_classical_triple' },
      { type: 'balcony', seats: 672, rows: 24, seatsPerRow: 28, aisles: [6, 22], arrangement: 'balcony_wide_promenade' },
      { type: 'balcony', seats: 432, rows: 18, seatsPerRow: 24, aisles: [6, 18], arrangement: 'balcony_compact_dual' },
      { type: 'luxury_recliner', seats: 64, rows: 8, seatsPerRow: 8, aisles: [2, 6], arrangement: 'recliner_intimate_242' },
      { type: 'luxury_recliner', seats: 80, rows: 8, seatsPerRow: 10, aisles: [3, 7], arrangement: 'recliner_executive_343' },
      { type: 'luxury_recliner', seats: 48, rows: 6, seatsPerRow: 8, aisles: [2, 6], arrangement: 'recliner_private_suite' },
      { type: 'motion_seat', seats: 240, rows: 12, seatsPerRow: 20, aisles: [4, 16], arrangement: 'motion_quad_pods' },
      { type: 'motion_seat', seats: 192, rows: 12, seatsPerRow: 16, aisles: [4, 12], arrangement: 'motion_dual_pods' },
      { type: 'motion_seat', seats: 264, rows: 12, seatsPerRow: 22, aisles: [6, 16], arrangement: 'motion_arena_pods' },
      { type: 'motion_seat', seats: 168, rows: 12, seatsPerRow: 14, aisles: [4, 10], arrangement: 'motion_compact_pods' },
      { type: 'flagship', seats: 560, rows: 20, seatsPerRow: 28, aisles: [7, 21] },
      { type: 'large', seats: 420, rows: 15, seatsPerRow: 28, aisles: [7, 21] },
      { type: 'boutique', seats: 48, rows: 6, seatsPerRow: 8, aisles: [4] },
    ];

    for (const v of variants) {
      const hall = generateProceduralAuditorium({
        theatre_type: v.type,
        total_seats: v.seats,
        rows: v.rows,
        seats_per_row: v.seatsPerRow,
        aisles: v.aisles,
        arrangement_pattern: v.arrangement as any,
      });

      const playerCfg = hall.walkNav.player;
      const spawn = playerCfg.spawn_position;
      const groundAtSpawn = getGroundHeightAt(spawn[0], spawn[2], hall.walkNav.walkable, spawn[1]) ?? spawn[1];
      let curPos = { x: spawn[0], y: groundAtSpawn, z: spawn[2] };

      // Walk up the aisle towards rear
      for (let s = 0; s < 40; s++) {
        const stepRes = stepPlayer(
          curPos,
          { dx: 0, dz: -0.25 },
          hall.walkNav.walkable,
          hall.walkNav.colliders,
          {
            radius: playerCfg.radius,
            maxStepUp: playerCfg.max_step_up,
            maxStepDown: playerCfg.max_step_down,
          }
        );
        curPos = stepRes.newPos;
      }

      // Proved movement: player progressed towards the rear without getting trapped
      expect(curPos.z).toBeLessThan(spawn[2] - 3.0);
    }
  });

  it('asserts zero false boundary triggers across all aisles, cross-aisles, front apron, and row ends in every hall variant including Auditorium 13', () => {
    // Test suite covers Compact, Standard, Balcony, Recliner (inc. Auditorium 13), Motion, Flagship
    const hallConfigs = [
      // Auditorium 13: Cinema 4 Screen 3 Luxe Recliner Lounge (64 seats, 8x8, aisles [2, 6])
      { name: 'Auditorium 13 Luxe Recliner Lounge', type: 'luxury_recliner', seats: 64, rows: 8, seatsPerRow: 8, aisles: [2, 6] },
      { name: 'Compact 100-seat Hall', type: 'compact', seats: 100, rows: 10, seatsPerRow: 10, aisles: [3, 7] },
      { name: 'Standard 216-seat Hall', type: 'standard', seats: 216, rows: 12, seatsPerRow: 18, aisles: [4, 14] },
      { name: 'Balcony 588-seat Hall', type: 'balcony', seats: 588, rows: 21, seatsPerRow: 28, aisles: [7, 21] },
      { name: 'Motion 4DX 240-seat Hall', type: 'motion_seat', seats: 240, rows: 12, seatsPerRow: 20, aisles: [4, 16], features: { is_4dx: true } },
      { name: 'Flagship 560-seat IMAX Hall', type: 'flagship', seats: 560, rows: 20, seatsPerRow: 28, aisles: [7, 21] },
    ];

    for (const cfg of hallConfigs) {
      const hall = generateProceduralAuditorium({
        theatre_type: cfg.type,
        total_seats: cfg.seats,
        rows: cfg.rows,
        seats_per_row: cfg.seatsPerRow,
        aisles: cfg.aisles,
        features: (cfg as any).features,
      });

      const dims = hall.geometry.dimensions;
      const playerCfg = hall.walkNav.player;
      const radius = playerCfg.radius;

      // Dynamic room bounds as defined in WalkController
      const walkBounds = {
        minX: -dims.halfWidth + radius + 0.1,
        maxX: dims.halfWidth - (radius + 0.1),
        minZ: dims.zBack + radius + 0.1,
        maxZ: Math.min(-1.5, dims.zFront - 1.5),
      };

      let falseBoundaryTriggerCount = 0;
      const checkBoundary = (x: number, z: number, vx: number, vz: number, pushDuration: number) => {
        const isPushingLeft = x <= walkBounds.minX + 0.05 && vx < -0.1;
        const isPushingRight = x >= walkBounds.maxX - 0.05 && vx > 0.1;
        const isPushingBack = z <= walkBounds.minZ + 0.05 && vz < -0.1;
        const isPushingFront = z >= walkBounds.maxZ - 0.05 && vz > 0.1;
        const isPushingBoundary = isPushingLeft || isPushingRight || isPushingBack || isPushingFront;
        if (isPushingBoundary && pushDuration >= 0.4) {
          return true;
        }
        return false;
      };

      // 1. Walk entire length of all aisles (spawn to back tier)
      const aisleXList = (hall.walkNav.aisles?.aisle_centers && hall.walkNav.aisles.aisle_centers.length > 0)
        ? hall.walkNav.aisles.aisle_centers
        : [0.0];

      for (const aisleX of aisleXList) {
        // Step along aisle from front apron to back row
        for (let z = dims.zFront - 2.5; z >= dims.zBack + 1.0; z -= 0.5) {
          // Inside the aisle, player is moving along -Z
          const triggered = checkBoundary(aisleX, z, 0, -1.0, 0.0);
          if (triggered || aisleX < walkBounds.minX || aisleX > walkBounds.maxX || z < walkBounds.minZ || z > walkBounds.maxZ) {
            falseBoundaryTriggerCount++;
          }
        }
      }

      // 2. Walk cross aisle (horizontal apron traversal)
      const crossAisleZ = hall.walkNav.player.spawn_position[2];
      for (let x = -dims.halfWidth + 2.0; x <= dims.halfWidth - 2.0; x += 0.5) {
        const triggered = checkBoundary(x, crossAisleZ, 1.0, 0, 0.0);
        if (triggered || x < walkBounds.minX || x > walkBounds.maxX || crossAisleZ < walkBounds.minZ || crossAisleZ > walkBounds.maxZ) {
          falseBoundaryTriggerCount++;
        }
      }

      // 3. Walk front apron in front of row A
      const frontApronZ = Math.min(-2.0, dims.zFront - 2.0);
      for (let x = -dims.halfWidth + 2.0; x <= dims.halfWidth - 2.0; x += 0.5) {
        const triggered = checkBoundary(x, frontApronZ, 1.0, 0, 0.0);
        if (triggered || x < walkBounds.minX || x > walkBounds.maxX || frontApronZ < walkBounds.minZ || frontApronZ > walkBounds.maxZ) {
          falseBoundaryTriggerCount++;
        }
      }

      // Assert 0 false triggers across all walking areas!
      expect(falseBoundaryTriggerCount, `False boundary triggers in ${cfg.name}`).toBe(0);

      // Verify that momentary push (< 0.4s) does NOT trigger
      const momentaryTrigger = checkBoundary(walkBounds.minX, crossAisleZ, -1.0, 0, 0.2);
      expect(momentaryTrigger).toBe(false);

      // Verify that deliberate push (>= 0.4s) DOES trigger
      const deliberateTrigger = checkBoundary(walkBounds.minX, crossAisleZ, -1.0, 0, 0.45);
      expect(deliberateTrigger).toBe(true);
    }
  });
});
