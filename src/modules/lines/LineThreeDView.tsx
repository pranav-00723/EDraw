/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [activePreset, setActivePreset] = useState<'isometric' | 'front' | 'top'>('isometric');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>(true);

  // Scene sub-groups for view filtering
  const hpGroupRef = useRef<THREE.Group | null>(null);
  const vpGroupRef = useRef<THREE.Group | null>(null);
  const groundLineGroupRef = useRef<THREE.Group | null>(null);
  const spaceLineGroupRef = useRef<THREE.Group | null>(null);
  const frontViewGroupRef = useRef<THREE.Group | null>(null);
  const topViewGroupRef = useRef<THREE.Group | null>(null);
  const tracesGroupRef = useRef<THREE.Group | null>(null);
  const foldGroupRef = useRef<THREE.Group | null>(null);
  const [unfoldAngle, setUnfoldAngle] = useState<number>(0);

  // Interaction tracking
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(40, 20, 20));

  const updateVisibilityForPreset = useCallback((preset: 'isometric' | 'front' | 'top') => {
    const spaceGroup = spaceLineGroupRef.current;
    const hpGroup = hpGroupRef.current;
    const vpGroup = vpGroupRef.current;
    const frontView = frontViewGroupRef.current;
    const topView = topViewGroupRef.current;
    const tracesGroup = tracesGroupRef.current;
    const groundLine = groundLineGroupRef.current;

    if (preset === 'front') {
      // ONLY the Front View is visible: VP plane + Front View on VP + XY line
      if (spaceGroup) spaceGroup.visible = false;
      if (hpGroup) hpGroup.visible = false;
      if (topView) topView.visible = false;
      if (tracesGroup) tracesGroup.visible = false;
      if (vpGroup) vpGroup.visible = true;
      if (frontView) frontView.visible = true;
      if (groundLine) groundLine.visible = true;
    } else if (preset === 'top') {
      // ONLY the Top View is visible: HP plane + Top View on HP + XY line
      if (spaceGroup) spaceGroup.visible = false;
      if (vpGroup) vpGroup.visible = false;
      if (frontView) frontView.visible = false;
      if (tracesGroup) tracesGroup.visible = false;
      if (hpGroup) hpGroup.visible = true;
      if (topView) topView.visible = true;
      if (groundLine) groundLine.visible = true;
    } else {
      // Isometric 3D Space: everything visible
      if (spaceGroup) spaceGroup.visible = true;
      if (hpGroup) hpGroup.visible = true;
      if (vpGroup) vpGroup.visible = true;
      if (frontView) frontView.visible = true;
      if (topView) topView.visible = true;
      if (tracesGroup) tracesGroup.visible = true;
      if (groundLine) groundLine.visible = true;
    }
  }, []);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 600;
    const height = 480;

    let renderer: THREE.WebGLRenderer;
    let dom: HTMLElement;
    let animationId: number;

    try {
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(isDark ? 0x090d16 : 0xf8fafc);

      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
      cameraRef.current = camera;
      camera.position.set(160, 140, 200);
      camera.lookAt(cameraTarget.current);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
      rendererRef.current = renderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      dom = renderer.domElement;
      mountRef.current.replaceChildren(dom);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.8 : 0.95);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
      dirLight1.position.set(150, 200, 150);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      dirLight2.position.set(-150, -100, -100);
      scene.add(dirLight2);

      const render = () => {
        animationId = requestAnimationFrame(render);
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      render();
    } catch (err) {
      console.warn('WebGL init failed in LineThreeDView:', err);
      setWebGlAvailable(false);
      return;
    }

    // Mouse handlers for orbit & pan
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
      setActivePreset((current) => {
        if (current !== 'isometric') {
          updateVisibilityForPreset('isometric');
          return 'isometric';
        }
        return current;
      });
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
      const w = mountRef.current.clientWidth || 600;
      cameraRef.current.aspect = w / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      try {
        renderer.forceContextLoss?.();
        renderer.dispose();
      } catch {}
      if (mountRef.current && mountRef.current.contains(dom)) {
        mountRef.current.removeChild(dom);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Update background when dark mode changes without destroying WebGL context
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDark ? 0x090d16 : 0xf8fafc);
    }
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

    // Sub-groups for precise Front View / Top View / 3D visibility control
    const hpGroup = new THREE.Group();
    hpGroupRef.current = hpGroup;
    root.add(hpGroup);

    const vpGroup = new THREE.Group();
    vpGroupRef.current = vpGroup;
    root.add(vpGroup);

    const groundLineGroup = new THREE.Group();
    groundLineGroupRef.current = groundLineGroup;
    root.add(groundLineGroup);

    const spaceLineGroup = new THREE.Group();
    spaceLineGroupRef.current = spaceLineGroup;
    root.add(spaceLineGroup);

    const frontViewGroup = new THREE.Group();
    frontViewGroupRef.current = frontViewGroup;
    root.add(frontViewGroup);

    const foldGroup = new THREE.Group();
    foldGroupRef.current = foldGroup;
    root.add(foldGroup);

    // Move hpGroup into foldGroup
    root.remove(hpGroup);
    foldGroup.add(hpGroup);

    const topViewGroup = new THREE.Group();
    topViewGroupRef.current = topViewGroup;
    foldGroup.add(topViewGroup);

    const tracesGroup = new THREE.Group();
    tracesGroupRef.current = tracesGroup;
    root.add(tracesGroup);

    const planeW = 260;
    const planeD = 200;
    const planeH = 200;

    // 1. Horizontal Plane (HP) - lies on X-Z plane (in Three.js Y=0)
    const hpGeo = new THREE.PlaneGeometry(planeW, planeD);
    const hpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hpColor),
      transparent: true,
      opacity: isDark ? 0.18 : 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const hpMesh = new THREE.Mesh(hpGeo, hpMat);
    hpMesh.rotation.x = Math.PI / 2;
    hpMesh.position.set(40, 0, 0);
    hpGroup.add(hpMesh);

    // HP Edges perimeter frame
    const hpEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(hpGeo),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(hpColor),
        transparent: true,
        opacity: 0.7,
        linewidth: 1.5,
      })
    );
    hpEdges.rotation.x = Math.PI / 2;
    hpEdges.position.set(40, 0, 0);
    hpGroup.add(hpEdges);

    // 2. Vertical Plane (VP) - lies on X-Y plane (in Three.js Z=0)
    const vpGeo = new THREE.PlaneGeometry(planeW, planeH);
    const vpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(vpColor),
      transparent: true,
      opacity: isDark ? 0.18 : 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const vpMesh = new THREE.Mesh(vpGeo, vpMat);
    vpMesh.position.set(40, 0, 0);
    vpGroup.add(vpMesh);

    // VP Edges perimeter frame
    const vpEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(vpGeo),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(vpColor),
        transparent: true,
        opacity: 0.7,
        linewidth: 1.5,
      })
    );
    vpEdges.position.set(40, 0, 0);
    vpGroup.add(vpEdges);

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
    groundLineGroup.add(xyLine);

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
    groundLineGroup.add(xLabel);

    const yLabel = createTextSprite('Y', isDark ? '#ffffff' : '#0f172a', 32);
    yLabel.position.set(175, 4, 0);
    groundLineGroup.add(yLabel);

    // Plane Labels
    const hpLabelSprite = createTextSprite('TOP VIEW (HP)', hpColor, 20);
    hpLabelSprite.position.set(130, 2, 70);
    hpGroup.add(hpLabelSprite);

    const vpLabelSprite = createTextSprite('FRONT VIEW (VP)', vpColor, 20);
    vpLabelSprite.position.set(130, 70, 2);
    vpGroup.add(vpLabelSprite);

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
    if (posA3D.distanceTo(posB3D) > 0.5) {
      const lineCurve = new THREE.LineCurve3(posA3D, posB3D);
      const lineTubeGeo = new THREE.TubeGeometry(lineCurve, 20, 1.2, 8, false);
      const lineTubeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981, // Emerald green for line in space
        roughness: 0.2,
        metalness: 0.5,
      });
      const lineMesh = new THREE.Mesh(lineTubeGeo, lineTubeMat);
      spaceLineGroup.add(lineMesh);
    }

    // Spheres for Ends A and B in Space - reduced size
    const endGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const endMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.1,
    });

    const sphereA = new THREE.Mesh(endGeo, endMat);
    sphereA.position.copy(posA3D);
    spaceLineGroup.add(sphereA);

    const sphereB = new THREE.Mesh(endGeo, endMat);
    sphereB.position.copy(posB3D);
    spaceLineGroup.add(sphereB);

    // Labels for Ends in Space
    const labelA3D = createTextSprite(line.nameA, '#10b981', 28);
    labelA3D.position.set(posA3D.x - 6, posA3D.y + 6, posA3D.z);
    spaceLineGroup.add(labelA3D);

    const labelB3D = createTextSprite(line.nameB, '#10b981', 28);
    labelB3D.position.set(posB3D.x + 6, posB3D.y + 6, posB3D.z);
    spaceLineGroup.add(labelB3D);

    // 6. Front View (Elevation) on VP: a′b′
    const projGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const fvMarkerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(vpColor) });

    if (posA_VP.distanceTo(posB_VP) > 0.5) {
      const fvCurve = new THREE.LineCurve3(posA_VP, posB_VP);
      const fvTubeGeo = new THREE.TubeGeometry(fvCurve, 20, 1.0, 8, false);
      const fvMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(vpColor),
        roughness: 0.3,
      });
      const fvMesh = new THREE.Mesh(fvTubeGeo, fvMat);
      frontViewGroup.add(fvMesh);

      const markerA_VP = new THREE.Mesh(projGeo, fvMarkerMat);
      markerA_VP.position.copy(posA_VP);
      frontViewGroup.add(markerA_VP);

      const markerB_VP = new THREE.Mesh(projGeo, fvMarkerMat);
      markerB_VP.position.copy(posB_VP);
      frontViewGroup.add(markerB_VP);

      const labelA_VP = createTextSprite(line.aFront.label, vpColor, 26);
      labelA_VP.position.set(posA_VP.x - 6, posA_VP.y + 6, 2);
      frontViewGroup.add(labelA_VP);

      const labelB_VP = createTextSprite(line.bFront.label, vpColor, 26);
      labelB_VP.position.set(posB_VP.x + 6, posB_VP.y + 6, 2);
      frontViewGroup.add(labelB_VP);
    } else {
      // Front view is a single point (Perpendicular to VP)
      const marker_VP = new THREE.Mesh(projGeo, fvMarkerMat);
      marker_VP.position.copy(posA_VP);
      frontViewGroup.add(marker_VP);

      const label_VP = createTextSprite(line.aFront.label, vpColor, 26);
      label_VP.position.set(posA_VP.x + 8, posA_VP.y + 4, 2);
      frontViewGroup.add(label_VP);
    }

    // 7. Top View (Plan) on HP: ab
    const tvMarkerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hpColor) });

    if (posA_HP.distanceTo(posB_HP) > 0.5) {
      const tvCurve = new THREE.LineCurve3(posA_HP, posB_HP);
      const tvTubeGeo = new THREE.TubeGeometry(tvCurve, 20, 1.1, 8, false);
      const tvMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hpColor),
        roughness: 0.3,
      });
      const tvMesh = new THREE.Mesh(tvTubeGeo, tvMat);
      topViewGroup.add(tvMesh);

      const markerA_HP = new THREE.Mesh(projGeo, tvMarkerMat);
      markerA_HP.position.copy(posA_HP);
      topViewGroup.add(markerA_HP);

      const markerB_HP = new THREE.Mesh(projGeo, tvMarkerMat);
      markerB_HP.position.copy(posB_HP);
      topViewGroup.add(markerB_HP);

      const labelA_HP = createTextSprite(line.aTop.label, hpColor, 26);
      labelA_HP.position.set(posA_HP.x - 6, 2, posA_HP.z + 6);
      topViewGroup.add(labelA_HP);

      const labelB_HP = createTextSprite(line.bTop.label, hpColor, 26);
      labelB_HP.position.set(posB_HP.x + 6, 2, posB_HP.z + 6);
      topViewGroup.add(labelB_HP);
    } else {
      // Top view is a single point (Perpendicular to HP, e.g. a(b))
      const marker_HP = new THREE.Mesh(projGeo, tvMarkerMat);
      marker_HP.position.copy(posA_HP);
      topViewGroup.add(marker_HP);

      const label_HP = createTextSprite(line.aTop.label, hpColor, 26);
      label_HP.position.set(posA_HP.x + 8, 2, posA_HP.z + 4);
      topViewGroup.add(label_HP);
    }

    // 8. Orthogonal Projector Lines (continuous thin lines)
    const projectorMat = new THREE.LineBasicMaterial({
      color: isDark ? 0x94a3b8 : 0x64748b,
      linewidth: 1.0,
      transparent: true,
      opacity: 0.8,
    });

    const createProjector = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      return new THREE.Line(geo, projectorMat);
    };

    // Projectors from Space A -> a' and a (added to spaceLineGroup)
    spaceLineGroup.add(createProjector(posA3D, posA_VP));
    spaceLineGroup.add(createProjector(posA3D, posA_HP));
    // Projectors from Space B -> b' and b (added to spaceLineGroup)
    spaceLineGroup.add(createProjector(posB3D, posB_VP));
    spaceLineGroup.add(createProjector(posB3D, posB_HP));

    // Projectors on VP to XY axis (added to frontViewGroup)
    const posA_XY = new THREE.Vector3(line.xA, 0, 0);
    const posB_XY = new THREE.Vector3(line.xB, 0, 0);
    frontViewGroup.add(createProjector(posA_VP, posA_XY));
    frontViewGroup.add(createProjector(posB_VP, posB_XY));

    // Projectors on HP to XY axis (added to topViewGroup)
    topViewGroup.add(createProjector(posA_HP, posA_XY));
    topViewGroup.add(createProjector(posB_HP, posB_XY));

    const createDottedExtension = (p1: THREE.Vector3, p2: THREE.Vector3, hexColor: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineDashedMaterial({
        color: hexColor,
        dashSize: 3,
        gapSize: 2.5,
        linewidth: 1.5,
      });
      const l = new THREE.Line(geo, mat);
      l.computeLineDistances();
      return l;
    };

    // 9. Traces (HT & VT) if existing, with dotted projection extensions
    if (line.ht.exists) {
      const htPos = new THREE.Vector3(line.ht.x, 0, line.ht.y);
      const hPrimePos = new THREE.Vector3(line.ht.x, 0, 0);

      const htMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      htMesh.position.copy(htPos);
      tracesGroup.add(htMesh);

      const htLabel = createTextSprite('HT', '#f59e0b', 22);
      htLabel.position.set(htPos.x + 6, 3, htPos.z + 6);
      tracesGroup.add(htLabel);

      // Extend Front View (a'b') to h' on XY, then perpendicular to HT, and extend Top View (ab) to HT
      const nearVP = posA_VP.distanceTo(hPrimePos) <= posB_VP.distanceTo(hPrimePos) ? posA_VP : posB_VP;
      const nearHP = posA_HP.distanceTo(htPos) <= posB_HP.distanceTo(htPos) ? posA_HP : posB_HP;
      tracesGroup.add(createDottedExtension(nearVP, hPrimePos, 0xf59e0b));
      tracesGroup.add(createDottedExtension(hPrimePos, htPos, 0xf59e0b));
      tracesGroup.add(createDottedExtension(nearHP, htPos, 0xf59e0b));
    }

    if (line.vt.exists) {
      const vtPos = new THREE.Vector3(line.vt.x, line.vt.z, 0);
      const vPos = new THREE.Vector3(line.vt.x, 0, 0);

      const vtMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      vtMesh.position.copy(vtPos);
      tracesGroup.add(vtMesh);

      const vtLabel = createTextSprite('VT', '#f59e0b', 22);
      vtLabel.position.set(vtPos.x + 6, vtPos.y + 6, 2);
      tracesGroup.add(vtLabel);

      // Extend Top View (ab) to v on XY, then perpendicular to VT, and extend Front View (a'b') to VT
      const nearHP = posA_HP.distanceTo(vPos) <= posB_HP.distanceTo(vPos) ? posA_HP : posB_HP;
      const nearVP = posA_VP.distanceTo(vtPos) <= posB_VP.distanceTo(vtPos) ? posA_VP : posB_VP;
      tracesGroup.add(createDottedExtension(nearHP, vPos, 0xf59e0b));
      tracesGroup.add(createDottedExtension(vPos, vtPos, 0xf59e0b));
      tracesGroup.add(createDottedExtension(nearVP, vtPos, 0xf59e0b));
    }

    scene.add(root);
    updateVisibilityForPreset(activePreset);
  }, [line, hpColor, vpColor, isDark, activePreset, updateVisibilityForPreset]);

  // Handle HP 90° Clockwise Unfolding & Folding Arc
  useEffect(() => {
    const foldGroup = foldGroupRef.current;
    const spaceGroup = spaceLineGroupRef.current;
    const tracesGroup = tracesGroupRef.current;
    const scene = sceneRef.current;
    if (!foldGroup) return;

    const rad = (unfoldAngle * Math.PI) / 180;
    foldGroup.rotation.x = rad;

    // When unfolded, hide 3D space line & 3D traces so projections alone are visible
    if (spaceGroup) {
      spaceGroup.visible = activePreset === 'isometric' && unfoldAngle === 0;
    }
    if (tracesGroup) {
      tracesGroup.visible = activePreset === 'isometric' && unfoldAngle === 0;
    }

    if (scene) {
      const oldArc = scene.getObjectByName('lineFoldingArc');
      if (oldArc) scene.remove(oldArc);
      if (unfoldAngle > 0) {
        const arcPts: THREE.Vector3[] = [];
        const arcRadius = 40;
        const arcX = 110;
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * rad;
          arcPts.push(new THREE.Vector3(arcX, -arcRadius * Math.sin(a), arcRadius * Math.cos(a)));
        }
        const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
        const arcMat = new THREE.LineDashedMaterial({
          color: 0xf59e0b,
          dashSize: 3,
          gapSize: 2,
          linewidth: 2,
        });
        const arcLine = new THREE.Line(arcGeo, arcMat);
        arcLine.computeLineDistances();
        arcLine.name = 'lineFoldingArc';
        scene.add(arcLine);
      }
    }
  }, [unfoldAngle, activePreset]);

  // Camera presets
  const applyCameraPreset = (preset: 'isometric' | 'front' | 'top', isoDir: 'SE' | 'SW' | 'NE' | 'NW' = 'SE') => {
    if (!cameraRef.current) return;
    setActivePreset(preset);
    const cam = cameraRef.current;
    const target = cameraTarget.current;

    switch (preset) {
      case 'isometric': {
        const xSign = isoDir === 'SE' || isoDir === 'NE' ? 1 : -1;
        const zSign = isoDir === 'SE' || isoDir === 'SW' ? 1 : -1;
        cam.position.set(40 + xSign * 120, 140, zSign * 180);
        break;
      }
      case 'front':
        // Looking directly at VP (along Z axis)
        cam.position.set(40, 20, 280);
        break;
      case 'top':
        // Looking directly at HP from above (along Y axis)
        cam.position.set(40, 280, 0.1);
        break;
    }
    cam.lookAt(target);
    updateVisibilityForPreset(preset);
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
      <div ref={mountRef} className="w-full h-[480px] cursor-grab active:cursor-grabbing">
        {!webGlAvailable && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900">
            <p className="text-sm font-semibold">3D WebGL Acceleration Unavailable in this browser view.</p>
            <p className="text-xs mt-1 max-w-sm">
              The 2D Orthographic Projection and Rotating Line method views remain fully interactive.
            </p>
          </div>
        )}
      </div>

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
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded p-0.5">
          {(['SW', 'SE', 'NW', 'NE'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => applyCameraPreset('isometric', dir)}
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              className={`px-1.5 py-1 text-xs sm:text-sm tracking-wider rounded transition cursor-pointer ${
                activePreset === 'isometric'
                  ? 'hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={`Isometric ${dir} View`}
            >
              {dir}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const target = unfoldAngle > 45 ? 0 : 90;
            const start = unfoldAngle;
            const startTime = performance.now();
            const duration = 600;
            const step = (now: number) => {
              const t = Math.min(1, (now - startTime) / duration);
              const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              setUnfoldAngle(Math.round(start + (target - start) * eased));
              if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition cursor-pointer ${
            unfoldAngle > 0
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
          title="Unfold HP 90° clockwise to view projections alone"
        >
          {unfoldAngle === 0 ? 'Unfold HP 90°' : `Fold Back (${unfoldAngle}°)`}
        </button>
        <button
          onClick={() => applyCameraPreset('front')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className={`px-2.5 py-1 text-sm tracking-wider rounded transition ${
            activePreset === 'front'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
          title="Front View (Elevation on VP — Only Front View Visible)"
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
          title="Top View (Plan on HP — Only Top View Visible)"
        >
          TOP(HP)
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
