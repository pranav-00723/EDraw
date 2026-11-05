/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ComputedLine } from '../../types/lines';
import { Eye, RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface LineThreeDViewProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  onChangeHpColor?: (color: string) => void;
  onChangeVpColor?: (color: string) => void;
  isDark?: boolean;
}

export const LineThreeDView: React.FC<LineThreeDViewProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  onChangeHpColor,
  onChangeVpColor,
  isDark = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activePreset, setActivePreset] = useState<string>('isometric');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Interaction tracking
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(40, 20, 20));

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isDark ? 0x090d16 : 0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    cameraRef.current = camera;
    camera.position.set(160, 140, 200);
    camera.lookAt(cameraTarget.current);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    mountRef.current.replaceChildren(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.8 : 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(150, 200, 150);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-150, -100, -100);
    scene.add(dirLight2);

    let animationId: number;
    const render = () => {
      animationId = requestAnimationFrame(render);
      renderer.render(scene, camera);
    };
    render();

    // Mouse handlers for orbit & pan
    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const dx = e.clientX - prevMousePos.current.x;
      const dy = e.clientY - prevMousePos.current.y;

      const cam = cameraRef.current;
      const radius = cam.position.distanceTo(cameraTarget.current);

      let theta = Math.atan2(cam.position.x - cameraTarget.current.x, cam.position.z - cameraTarget.current.z);
      let phi = Math.acos(
        Math.max(-1, Math.min(1, (cam.position.y - cameraTarget.current.y) / radius))
      );

      theta -= dx * 0.007;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi - dy * 0.007));

      cam.position.x = cameraTarget.current.x + radius * Math.sin(phi) * Math.sin(theta);
      cam.position.y = cameraTarget.current.y + radius * Math.cos(phi);
      cam.position.z = cameraTarget.current.z + radius * Math.sin(phi) * Math.cos(theta);

      cam.lookAt(cameraTarget.current);
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const cam = cameraRef.current;
      const dir = new THREE.Vector3().subVectors(cam.position, cameraTarget.current).normalize();
      const currentDist = cam.position.distanceTo(cameraTarget.current);
      const newDist = Math.max(40, Math.min(800, currentDist + e.deltaY * 0.4));
      cam.position.copy(cameraTarget.current).addScaledVector(dir, newDist);
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      cameraRef.current.aspect = w / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isDark]);

  // Update Scene Objects whenever line, colors, or theme change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear dynamic elements
    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach((child) => {
      if (child.name === 'plane-or-point-object') {
        toRemove.push(child);
      }
    });
    toRemove.forEach((obj) => scene.remove(obj));

    const root = new THREE.Group();
    root.name = 'plane-or-point-object';

    const planeW = 260;
    const planeD = 200;
    const planeH = 200;

    // 1. Horizontal Plane (HP) - lies on X-Z plane (in Three.js Y=0)
    // Three.js coordinates mapping:
    // User X (lateral along XY) -> Three.js X
    // User Z (height above HP)  -> Three.js Y
    // User Y (depth from VP, +front) -> Three.js Z (+Z is in front of VP)
    const hpGeo = new THREE.PlaneGeometry(planeW, planeD);
    const hpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hpColor),
      transparent: true,
      opacity: isDark ? 0.35 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const hpMesh = new THREE.Mesh(hpGeo, hpMat);
    hpMesh.rotation.x = Math.PI / 2;
    hpMesh.position.set(40, 0, 0);
    root.add(hpMesh);

    // HP Edges
    const hpEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(hpGeo),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(hpColor),
        transparent: true,
        opacity: 0.8,
        linewidth: 1.5,
      })
    );
    hpEdges.rotation.x = Math.PI / 2;
    hpEdges.position.set(40, 0, 0);
    root.add(hpEdges);

    // HP Sub-grid
    const hpGrid = new THREE.GridHelper(planeD, 10, new THREE.Color(hpColor), new THREE.Color(hpColor));
    (hpGrid.material as THREE.Material).opacity = 0.2;
    (hpGrid.material as THREE.Material).transparent = true;
    hpGrid.position.set(40, 0, 0);
    root.add(hpGrid);

    // 2. Vertical Plane (VP) - lies on X-Y plane (in Three.js Z=0)
    const vpGeo = new THREE.PlaneGeometry(planeW, planeH);
    const vpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(vpColor),
      transparent: true,
      opacity: isDark ? 0.32 : 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const vpMesh = new THREE.Mesh(vpGeo, vpMat);
    vpMesh.position.set(40, 0, 0);
    root.add(vpMesh);

    // VP Edges
    const vpEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(vpGeo),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(vpColor),
        transparent: true,
        opacity: 0.8,
        linewidth: 1.5,
      })
    );
    vpEdges.position.set(40, 0, 0);
    root.add(vpEdges);

    // VP Sub-grid
    const vpGrid = new THREE.GridHelper(planeH, 10, new THREE.Color(vpColor), new THREE.Color(vpColor));
    vpGrid.rotation.x = Math.PI / 2;
    (vpGrid.material as THREE.Material).opacity = 0.2;
    (vpGrid.material as THREE.Material).transparent = true;
    vpGrid.position.set(40, 0, 0);
    root.add(vpGrid);

    // 3. Ground Line (XY Line) - intersection of HP & VP
    const xyLineMat = new THREE.LineBasicMaterial({
      color: isDark ? 0xe2e8f0 : 0x0f172a,
      linewidth: 2.5,
    });
    const xyPoints = [
      new THREE.Vector3(-90, 0, 0),
      new THREE.Vector3(170, 0, 0),
    ];
    const xyGeo = new THREE.BufferGeometry().setFromPoints(xyPoints);
    const xyLine = new THREE.Line(xyGeo, xyLineMat);
    root.add(xyLine);

    // Labels for X and Y line
    const createTextSprite = (text: string, color: string, fontSize = 24) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(16, 8, 1);
      return sprite;
    };

    const xLabel = createTextSprite('X', isDark ? '#ffffff' : '#0f172a', 32);
    xLabel.position.set(-95, 4, 0);
    root.add(xLabel);

    const yLabel = createTextSprite('Y', isDark ? '#ffffff' : '#0f172a', 32);
    yLabel.position.set(175, 4, 0);
    root.add(yLabel);

    // Plane Labels
    const hpLabelSprite = createTextSprite('TOP VIEW (HP)', hpColor, 20);
    hpLabelSprite.position.set(130, 2, 70);
    root.add(hpLabelSprite);

    const vpLabelSprite = createTextSprite('FRONT VIEW (VP)', vpColor, 20);
    vpLabelSprite.position.set(130, 70, 2);
    root.add(vpLabelSprite);

    // 4. Coordinates of Line Ends in Space
    // User: (x, y, z) -> Three.js: (x, z, y)
    const posA3D = new THREE.Vector3(line.xA, line.zA, line.yA);
    const posB3D = new THREE.Vector3(line.xB, line.zB, line.yB);

    // Projections of End A
    const posA_VP = new THREE.Vector3(line.xA, line.zA, 0); // Front view a' on VP
    const posA_HP = new THREE.Vector3(line.xA, 0, line.yA); // Top view a on HP

    // Projections of End B
    const posB_VP = new THREE.Vector3(line.xB, line.zB, 0); // Front view b' on VP
    const posB_HP = new THREE.Vector3(line.xB, 0, line.yB); // Top view b on HP

    // 5. Line AB in Space (Thick tube / line)
    const lineCurve = new THREE.LineCurve3(posA3D, posB3D);
    const lineTubeGeo = new THREE.TubeGeometry(lineCurve, 20, 1.2, 8, false);
    const lineTubeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Emerald green for line in space
      roughness: 0.2,
      metalness: 0.5,
    });
    const lineMesh = new THREE.Mesh(lineTubeGeo, lineTubeMat);
    root.add(lineMesh);

    // Spheres for Ends A and B in Space - reduced size
    const endGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const endMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.1,
    });

    const sphereA = new THREE.Mesh(endGeo, endMat);
    sphereA.position.copy(posA3D);
    root.add(sphereA);

    const sphereB = new THREE.Mesh(endGeo, endMat);
    sphereB.position.copy(posB3D);
    root.add(sphereB);

    // Labels for Ends in Space
    const labelA3D = createTextSprite(line.nameA, '#10b981', 28);
    labelA3D.position.set(posA3D.x - 6, posA3D.y + 6, posA3D.z);
    root.add(labelA3D);

    const labelB3D = createTextSprite(line.nameB, '#10b981', 28);
    labelB3D.position.set(posB3D.x + 6, posB3D.y + 6, posB3D.z);
    root.add(labelB3D);

    // 6. Front View (Elevation) on VP: a′b′
    const fvCurve = new THREE.LineCurve3(posA_VP, posB_VP);
    const fvTubeGeo = new THREE.TubeGeometry(fvCurve, 20, 1.0, 8, false);
    const fvMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(vpColor),
      roughness: 0.3,
    });
    const fvMesh = new THREE.Mesh(fvTubeGeo, fvMat);
    root.add(fvMesh);

    // Spheres for a' and b' on VP - reduced size
    const projGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const fvMarkerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(vpColor) });

    const markerA_VP = new THREE.Mesh(projGeo, fvMarkerMat);
    markerA_VP.position.copy(posA_VP);
    root.add(markerA_VP);

    const markerB_VP = new THREE.Mesh(projGeo, fvMarkerMat);
    markerB_VP.position.copy(posB_VP);
    root.add(markerB_VP);

    const labelA_VP = createTextSprite(line.aFront.label, vpColor, 26);
    labelA_VP.position.set(posA_VP.x - 6, posA_VP.y + 6, 2);
    root.add(labelA_VP);

    const labelB_VP = createTextSprite(line.bFront.label, vpColor, 26);
    labelB_VP.position.set(posB_VP.x + 6, posB_VP.y + 6, 2);
    root.add(labelB_VP);

    // 7. Top View (Plan) on HP: ab
    const tvCurve = new THREE.LineCurve3(posA_HP, posB_HP);
    const tvTubeGeo = new THREE.TubeGeometry(tvCurve, 20, 1.1, 8, false);
    const tvMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hpColor),
      roughness: 0.3,
    });
    const tvMesh = new THREE.Mesh(tvTubeGeo, tvMat);
    root.add(tvMesh);

    // Spheres for a and b on HP
    const tvMarkerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hpColor) });

    const markerA_HP = new THREE.Mesh(projGeo, tvMarkerMat);
    markerA_HP.position.copy(posA_HP);
    root.add(markerA_HP);

    const markerB_HP = new THREE.Mesh(projGeo, tvMarkerMat);
    markerB_HP.position.copy(posB_HP);
    root.add(markerB_HP);

    const labelA_HP = createTextSprite(line.aTop.label, hpColor, 26);
    labelA_HP.position.set(posA_HP.x - 6, 2, posA_HP.z + 6);
    root.add(labelA_HP);

    const labelB_HP = createTextSprite(line.bTop.label, hpColor, 26);
    labelB_HP.position.set(posB_HP.x + 6, 2, posB_HP.z + 6);
    root.add(labelB_HP);

    // 8. Orthogonal Projector Lines (dashed or thin lines)
    const projectorMat = new THREE.LineDashedMaterial({
      color: isDark ? 0x94a3b8 : 0x64748b,
      dashSize: 3,
      gapSize: 2,
    });

    const addDashedLine = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(geo, projectorMat);
      line.computeLineDistances();
      root.add(line);
    };

    // Projectors from Space A -> a' and a
    addDashedLine(posA3D, posA_VP);
    addDashedLine(posA3D, posA_HP);
    // Projectors from Space B -> b' and b
    addDashedLine(posB3D, posB_VP);
    addDashedLine(posB3D, posB_HP);

    // Projectors to XY axis
    const posA_XY = new THREE.Vector3(line.xA, 0, 0);
    const posB_XY = new THREE.Vector3(line.xB, 0, 0);
    addDashedLine(posA_VP, posA_XY);
    addDashedLine(posA_HP, posA_XY);
    addDashedLine(posB_VP, posB_XY);
    addDashedLine(posB_HP, posB_XY);

    // 9. Traces (HT & VT) if existing
    if (line.ht.exists) {
      const htPos = new THREE.Vector3(line.ht.x, 0, line.ht.y);
      const htMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      htMesh.position.copy(htPos);
      root.add(htMesh);

      const htLabel = createTextSprite('HT', '#f59e0b', 22);
      htLabel.position.set(htPos.x + 6, 3, htPos.z + 6);
      root.add(htLabel);
    }

    if (line.vt.exists) {
      const vtPos = new THREE.Vector3(line.vt.x, line.vt.z, 0);
      const vtMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      vtMesh.position.copy(vtPos);
      root.add(vtMesh);

      const vtLabel = createTextSprite('VT', '#f59e0b', 22);
      vtLabel.position.set(vtPos.x + 6, vtPos.y + 6, 2);
      root.add(vtLabel);
    }

    scene.add(root);
  }, [line, hpColor, vpColor, isDark]);

  // Camera presets
  const applyCameraPreset = (preset: 'isometric' | 'front' | 'top' | 'profile') => {
    if (!cameraRef.current) return;
    setActivePreset(preset);
    const cam = cameraRef.current;
    const target = cameraTarget.current;

    switch (preset) {
      case 'isometric':
        cam.position.set(160, 140, 200);
        break;
      case 'front':
        // Looking directly at VP (along Z axis)
        cam.position.set(40, 20, 280);
        break;
      case 'top':
        // Looking directly at HP from above (along Y axis)
        cam.position.set(40, 280, 0.1);
        break;
      case 'profile':
        // Side view / Profile plane (along X axis)
        cam.position.set(280, 20, 20);
        break;
    }
    cam.lookAt(target);
  };

  const handleZoom = (factor: number) => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const dir = new THREE.Vector3().subVectors(cam.position, cameraTarget.current).normalize();
    const currentDist = cam.position.distanceTo(cameraTarget.current);
    const newDist = Math.max(40, Math.min(800, currentDist * factor));
    cam.position.copy(cameraTarget.current).addScaledVector(dir, newDist);
  };

  return (
    <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-[480px] cursor-grab active:cursor-grabbing" />

      {/* Top Left Plane Legend & Color Chooser */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-xs">
        {/* HP Legend */}
        <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition">
          <input
            type="color"
            value={hpColor}
            onChange={(e) => onChangeHpColor?.(e.target.value)}
            className="w-3.5 h-3.5 rounded border-0 p-0 cursor-pointer"
            title="Click to change Horizontal Plane (HP) Color"
          />
          <span className="font-semibold text-slate-700 dark:text-slate-300">HP (Plan)</span>
        </label>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* VP Legend */}
        <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition">
          <input
            type="color"
            value={vpColor}
            onChange={(e) => onChangeVpColor?.(e.target.value)}
            className="w-3.5 h-3.5 rounded border-0 p-0 cursor-pointer"
            title="Click to change Vertical Plane (VP) Color"
          />
          <span className="font-semibold text-slate-700 dark:text-slate-300">VP (Elevation)</span>
        </label>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Line AB Legend */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Line {line.nameA}{line.nameB}</span>
        </div>
      </div>

      {/* Top Right Camera Presets (Bebas Neue Font) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          onClick={() => applyCameraPreset('isometric')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition ${
            activePreset === 'isometric'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Isometric
        </button>
        <button
          onClick={() => applyCameraPreset('front')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition ${
            activePreset === 'front'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Front(VP)
        </button>
        <button
          onClick={() => applyCameraPreset('top')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition ${
            activePreset === 'top'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          TOP(HP)
        </button>
        <button
          onClick={() => applyCameraPreset('profile')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition ${
            activePreset === 'profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
          title="Side View"
        >
          side view
        </button>
      </div>

      {/* Bottom Right Floating Zoom / Reset Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          onClick={() => handleZoom(0.85)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(1.15)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => applyCameraPreset('isometric')}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left Navigation Tip */}
      <div className="absolute bottom-3 left-3 text-[11px] font-mono text-slate-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200/50 dark:border-slate-800/50 pointer-events-none hidden sm:block">
        Drag to Orbit • Scroll to Zoom
      </div>
    </div>
  );
};
