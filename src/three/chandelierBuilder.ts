import * as THREE from 'three';
import type { ApartmentRoom, PlacedChandelier } from '../types/ikea';
import { kelvinToHex } from '../utils/roomLogic';

export function buildChandelierGroup(
  chandelier: PlacedChandelier,
  room: ApartmentRoom | undefined,
  isSelected: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = `chandelier_${chandelier.instanceId}`;
  group.userData = {
    chandelierId: chandelier.instanceId,
    isChandelierGroup: true,
  };

  const ceilingY = room ? room.height : 2.7;
  const drop = Math.max(0.1, Math.min(1.8, chandelier.dropCableHeight));
  const scale = Math.max(0.5, Math.min(2.0, chandelier.scale));
  const lightHex = kelvinToHex(chandelier.colorTempK);
  const lightColor = new THREE.Color(lightHex);

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.26,
    metalness: 0.88,
  });
  const blackMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e20,
    roughness: 0.4,
    metalness: 0.75,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xc89d66,
    roughness: 0.65,
    metalness: 0.05,
  });
  const emitterMat = new THREE.MeshStandardMaterial({
    color: chandelier.isOn ? lightColor : new THREE.Color(0xd8d8d8),
    emissive: chandelier.isOn ? lightColor : new THREE.Color(0x000000),
    emissiveIntensity: chandelier.isOn ? (chandelier.brightness / 100) * 2.2 : 0,
    roughness: 0.18,
    metalness: 0.05,
  });

  // 1. Ceiling Canopy Rose at y = ceilingY
  const canopyGeom = new THREE.CylinderGeometry(0.09 * scale, 0.09 * scale, 0.035, 24);
  const canopyMesh = new THREE.Mesh(
    canopyGeom,
    chandelier.presetId === 'industrial_spider' ? blackMetalMat : brassMat
  );
  canopyMesh.position.set(0, ceilingY - 0.018, 0);
  canopyMesh.userData = { chandelierId: chandelier.instanceId };
  group.add(canopyMesh);

  // 2. Suspension Cable / Rod
  if (chandelier.presetId !== 'recessed_spotlights') {
    const cableGeom = new THREE.CylinderGeometry(0.008, 0.008, drop, 12);
    const cableMesh = new THREE.Mesh(cableGeom, blackMetalMat);
    cableMesh.position.set(0, ceilingY - drop / 2, 0);
    cableMesh.userData = { chandelierId: chandelier.instanceId };
    group.add(cableMesh);
  }

  const fixtureY =
    chandelier.presetId === 'recessed_spotlights' ? ceilingY - 0.04 : ceilingY - drop;

  // 3. Build Preset-Specific Multi-Part Chandelier Geometry
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, fixtureY, 0);
  bodyGroup.scale.setScalar(scale);

  if (chandelier.presetId === 'multi_ring_led') {
    const radii = [0.42, 0.3, 0.19];
    const heights = [0.06, -0.04, -0.13];
    const tilts = [0.14, -0.16, 0.1];
    for (let i = 0; i < 3; i++) {
      // Brass outer ring
      const frameRing = new THREE.Mesh(
        new THREE.TorusGeometry(radii[i], 0.014, 16, 48),
        brassMat
      );
      frameRing.rotation.x = Math.PI / 2 + tilts[i];
      frameRing.position.y = heights[i];
      frameRing.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(frameRing);

      // Inner glowing LED diffuser ring
      const ledRing = new THREE.Mesh(
        new THREE.TorusGeometry(radii[i] - 0.015, 0.012, 14, 48),
        emitterMat
      );
      ledRing.rotation.x = Math.PI / 2 + tilts[i];
      ledRing.position.y = heights[i] - 0.008;
      ledRing.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(ledRing);
    }
  } else if (chandelier.presetId === 'glass_globe_cluster') {
    const offsets: [number, number, number, number][] = [
      [0, 0, 0, 0.11],
      [0.16, 0.08, 0.06, 0.09],
      [-0.15, 0.04, 0.09, 0.095],
      [0.06, -0.09, -0.15, 0.085],
      [-0.11, -0.05, -0.13, 0.085],
      [0.14, 0.12, -0.1, 0.075],
      [-0.04, 0.14, 0.15, 0.08],
    ];
    for (const [ox, oy, oz, r] of offsets) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.38, 0.03, 16), brassMat);
      cap.position.set(ox, oy + r, oz);
      cap.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(cap);

      const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), emitterMat);
      globe.position.set(ox, oy, oz);
      globe.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(globe);
    }
  } else if (chandelier.presetId === 'woven_pendant') {
    // Layered woven bamboo dome ribs
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.009, 10, 28, Math.PI), bambooMat);
      rib.rotation.y = angle;
      rib.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(rib);
    }
    for (let h = 0; h < 5; h++) {
      const r = 0.24 * Math.cos((h / 5) * (Math.PI * 0.42));
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 10, 32), bambooMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = (h - 2) * 0.055;
      hoop.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(hoop);
    }
    const coreBulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), emitterMat);
    coreBulb.userData = { chandelierId: chandelier.instanceId };
    bodyGroup.add(coreBulb);
  } else if (chandelier.presetId === 'geodesic_chandelier') {
    const outerIco = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf4f2ed,
        roughness: 0.35,
        metalness: 0.15,
        wireframe: true,
      })
    );
    outerIco.userData = { chandelierId: chandelier.instanceId };
    bodyGroup.add(outerIco);

    const innerCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), emitterMat);
    innerCore.userData = { chandelierId: chandelier.instanceId };
    bodyGroup.add(innerCore);
  } else if (chandelier.presetId === 'industrial_spider') {
    const armCount = 8;
    for (let i = 0; i < armCount; i++) {
      const angle = (i * Math.PI * 2) / armCount;
      const ax = Math.cos(angle) * 0.38;
      const az = Math.sin(angle) * 0.38;

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 10), blackMetalMat);
      arm.position.set(ax * 0.5, 0.04, az * 0.5);
      arm.rotation.z = Math.PI / 2 - 0.2;
      arm.rotation.y = -angle;
      arm.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(arm);

      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.045, 12), brassMat);
      socket.position.set(ax, -0.02, az);
      socket.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(socket);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 14), emitterMat);
      bulb.position.set(ax, -0.065, az);
      bulb.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(bulb);
    }
  } else {
    // recessed_spotlights track bar
    const trackBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.028, 0.06), blackMetalMat);
    trackBar.userData = { chandelierId: chandelier.instanceId };
    bodyGroup.add(trackBar);

    for (const sx of [-0.36, -0.12, 0.12, 0.36]) {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 18), blackMetalMat);
      housing.position.set(sx, -0.03, 0);
      housing.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(housing);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 18), emitterMat);
      lens.position.set(sx, -0.062, 0);
      lens.userData = { chandelierId: chandelier.instanceId };
      bodyGroup.add(lens);
    }
  }

  group.add(bodyGroup);

  // Real THREE.PointLight casting warm/cool illumination into the room
  if (chandelier.isOn && chandelier.brightness > 0) {
    const pointLight = new THREE.PointLight(
      lightColor,
      (chandelier.brightness / 100) * 2.2,
      8.5,
      1.4
    );
    pointLight.position.set(0, fixtureY - 0.08, 0);
    pointLight.castShadow = false;
    group.add(pointLight);
  }

  if (isSelected) {
    const ringGeom = new THREE.RingGeometry(0.38 * scale, 0.42 * scale, 36);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0058a3,
      side: THREE.DoubleSide,
    });
    const selRing = new THREE.Mesh(ringGeom, ringMat);
    selRing.position.set(0, fixtureY, 0);
    group.add(selRing);
  }

  group.position.set(chandelier.position[0], 0, chandelier.position[2]);
  return group;
}
