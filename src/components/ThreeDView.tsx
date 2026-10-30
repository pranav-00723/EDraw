import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Procedural Rectangular Drafting Grid Geometry
function createRectGridGeometry(width: number, height: number, step: number = 20) {
  const pts: THREE.Vector3[] = [];
  const halfW = width / 2;
  const halfH = height / 2;

  // Lines stepped along X (parallel to height)
  for (let x = -halfW; x <= halfW + 0.1; x += step) {
    pts.push(new THREE.Vector3(x, -halfH, 0));
    pts.push(new THREE.Vector3(x, halfH, 0));
  }
  // Lines stepped along Y (parallel to width)
  for (let y = -halfH; y <= halfH + 0.1; y += step) {
    pts.push(new THREE.Vector3(-halfW, y, 0));
    pts.push(new THREE.Vector3(halfW, y, 0));
  }

  return new THREE.BufferGeometry().setFromPoints(pts);
}
import { ComputedPoint } from '../types/projection';
import {
  RotateCcw,
  Eye,
  Layers,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  HelpCircle,
} from 'lucide-react';

interface ThreeDViewProps {
  points: ComputedPoint[];
  selectedPointId: string | null;
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
  onChangeHpColor?: (color: string) => void;
  onChangeVpColor?: (color: string) => void;
}

// Procedural Sprite Label Generator
function createTextSprite(
  text: string,
  parameters: {
    fontsize?: number;
    fontface?: string;
    textColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderThickness?: number;
    padding?: number;
  } = {}
) {
  const fontface = parameters.fontface || 'JetBrains Mono, monospace';
  const fontsize = parameters.fontsize || 32;
  const borderThickness = parameters.borderThickness || 2;
  const borderColor = parameters.borderColor || 'rgba(0, 0, 0, 0.2)';
  const backgroundColor = parameters.backgroundColor || 'rgba(255, 255, 255, 0.9)';
  const textColor = parameters.textColor || '#0f172a';
  const padding = parameters.padding || 8;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();

  canvas.width = 384;
  canvas.height = 128;

  context.font = `bold ${fontsize}px ${fontface}`;
  context.textBaseline = 'middle';
  context.textAlign = 'center';

  const metrics = context.measureText(text);
  const textWidth = metrics.width;
  const boxWidth = Math.min(canvas.width - 20, Math.max(textWidth + padding * 4, 80));
  const boxHeight = fontsize + padding * 2;
  const boxX = (canvas.width - boxWidth) / 2;
  const boxY = (canvas.height - boxHeight) / 2;
  const radius = 8;

  // Background box
  context.beginPath();
  context.moveTo(boxX + radius, boxY);
  context.lineTo(boxX + boxWidth - radius, boxY);
  context.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
  context.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
  context.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
  context.lineTo(boxX + radius, boxY + boxHeight);
  context.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
  context.lineTo(boxX, boxY + radius);
  context.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
  context.closePath();

  context.fillStyle = backgroundColor;
  context.fill();
  context.lineWidth = borderThickness;
  context.strokeStyle = borderColor;
  context.stroke();

  // Text
  context.fillStyle = textColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(22, 7.3, 1);
  return sprite;
}

export const ThreeDView: React.FC<ThreeDViewProps> = ({
  points,
  selectedPointId,
  onSelectPoint,
  isDark = false,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  onChangeHpColor,
  onChangeVpColor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsGroupRef = useRef<THREE.Group | null>(null);
  const hpGroupRef = useRef<THREE.Group | null>(null);
  const vpGroupRef = useRef<THREE.Group | null>(null);
  const foldGroupRef = useRef<THREE.Group | null>(null); // HP pivot for 90-degree fold animation

  // Interactive settings state
  const [showHp, setShowHp] = useState(true);
  const [showVp, setShowVp] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showProjectors, setShowProjectors] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showQuadrants, setShowQuadrants] = useState(true);
  const [unfoldAngle, setUnfoldAngle] = useState(0); // 0 = 3D standard position, 90 = fully unfolded coplanar
  const [isAnimatingFold, setIsAnimatingFold] = useState(false);
  const [hoveredPointInfo, setHoveredPointInfo] = useState<{
    point: ComputedPoint;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Soft WebGL detection
  const isSoftwareGlRef = useRef(false);

  // Set up Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect software GL
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGlRef.current = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isDark ? 0x090d16 : 0xf8fafc);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    // Standard Isometric Engineering View: look from front-top-right
    camera.position.set(130, 95, 160);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGlRef.current,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGlRef.current ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGlRef.current;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGlRef.current;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 600;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(120, 160, 100);
    keyLight.castShadow = !isSoftwareGlRef.current;
    if (keyLight.shadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-100, -80, -100);
    scene.add(fillLight);

    // Root groups
    const foldGroup = new THREE.Group(); // rotates around X axis for HP unfolding
    scene.add(foldGroup);
    foldGroupRef.current = foldGroup;

    const hpGroup = new THREE.Group();
    foldGroup.add(hpGroup);
    hpGroupRef.current = hpGroup;

    const vpGroup = new THREE.Group();
    scene.add(vpGroup);
    vpGroupRef.current = vpGroup;

    const pointsGroup = new THREE.Group();
    scene.add(pointsGroup);
    pointsGroupRef.current = pointsGroup;

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Scene background when theme changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDark ? 0x090d16 : 0xf8fafc);
    }
  }, [isDark]);

  // Dynamic plane bounds so points never leave HP and VP, without making them look infinitely long
  const planeBounds = useMemo(() => {
    let minX = 0;
    let maxX = 0;
    let maxElevation = 35;
    let maxDepression = 35;
    let maxFront = 35;
    let maxBehind = 35;

    points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      // Three.js Y is height relative to HP (pt.z: +above, -below)
      if (pt.z > 0) maxElevation = Math.max(maxElevation, pt.z);
      if (pt.z < 0) maxDepression = Math.max(maxDepression, Math.abs(pt.z));
      // Three.js Z is depth relative to VP (pt.y: +in front, -behind)
      if (pt.y > 0) maxFront = Math.max(maxFront, pt.y);
      if (pt.y < 0) maxBehind = Math.max(maxBehind, Math.abs(pt.y));
    });

    const padX = 40;
    const startX = minX - padX;
    const endX = maxX + padX;
    const widthX = Math.max(endX - startX, 160);
    const centerX = (startX + endX) / 2;

    const maxVert = Math.max(maxElevation, maxDepression, 55) + 30;
    const heightY = maxVert * 2; // Symmetric above and below HP

    const maxDepth = Math.max(maxFront, maxBehind, 55) + 30;
    const depthZ = maxDepth * 2; // Symmetric in front and behind VP

    return {
      minX,
      maxX,
      startX,
      endX,
      widthX,
      centerX,
      maxVert,
      heightY,
      maxDepth,
      depthZ,
    };
  }, [points]);

  // Construct Reference Planes (HP and VP) and Reference Line (XY)
  useEffect(() => {
    const hpGroup = hpGroupRef.current;
    const vpGroup = vpGroupRef.current;
    const scene = sceneRef.current;
    if (!hpGroup || !vpGroup || !scene) return;

    // Clear old plane children
    while (hpGroup.children.length > 0) {
      const obj = hpGroup.children[0];
      hpGroup.remove(obj);
    }
    while (vpGroup.children.length > 0) {
      const obj = vpGroup.children[0];
      vpGroup.remove(obj);
    }

    const {
      startX,
      endX,
      widthX,
      centerX,
      maxVert,
      heightY,
      maxDepth,
      depthZ,
    } = planeBounds;

    const hpThreeColor = new THREE.Color(hpColor);
    const vpThreeColor = new THREE.Color(vpColor);

    // 1. HORIZONTAL PLANE (HP)
    // Lies in X-Z plane (Y = 0)
    // In Front of VP, Behind VP
    if (showHp) {
      const hpGeo = new THREE.PlaneGeometry(widthX, depthZ, 8, 8);
      const hpMat = new THREE.MeshPhysicalMaterial({
        color: hpThreeColor,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: isDark ? 0.38 : 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const hpMesh = new THREE.Mesh(hpGeo, hpMat);
      hpMesh.rotation.x = Math.PI / 2; // Flat horizontal plane
      hpMesh.position.set(centerX, 0, 0);
      hpMesh.receiveShadow = !isSoftwareGlRef.current;
      hpGroup.add(hpMesh);

      // HP Border wireframe
      const hpEdges = new THREE.EdgesGeometry(hpGeo);
      const hpLine = new THREE.LineSegments(
        hpEdges,
        new THREE.LineBasicMaterial({
          color: hpThreeColor,
          linewidth: 2,
        })
      );
      hpLine.rotation.x = Math.PI / 2;
      hpLine.position.set(centerX, 0, 0);
      hpGroup.add(hpLine);

      // HP Sub-grid lines (clean rectangular drafting grid)
      const hpGridGeo = createRectGridGeometry(widthX, depthZ, 20);
      const hpGrid = new THREE.LineSegments(
        hpGridGeo,
        new THREE.LineBasicMaterial({
          color: isDark ? 0x1e293b : 0xe2e8f0,
          transparent: true,
          opacity: 0.75,
        })
      );
      hpGrid.rotation.x = Math.PI / 2;
      hpGrid.position.set(centerX, 0.05, 0);
      hpGroup.add(hpGrid);

      // Labels on HP
      if (showLabels) {
        // Label HP
        const hpLabel = createTextSprite('HP (Horizontal Plane)', {
          fontsize: 24,
          textColor: hpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: hpColor,
        });
        hpLabel.position.set(startX + 30, 1, maxDepth - 16);
        hpGroup.add(hpLabel);

        // Direction indicators on HP
        const inFrontLabel = createTextSprite('▼ IN FRONT OF VP', {
          fontsize: 18,
          textColor: hpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: hpColor,
        });
        inFrontLabel.position.set(centerX, 0.5, maxDepth - 12);
        hpGroup.add(inFrontLabel);

        const behindLabel = createTextSprite('▲ BEHIND VP', {
          fontsize: 18,
          textColor: hpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: hpColor,
        });
        behindLabel.position.set(centerX, 0.5, -maxDepth + 12);
        hpGroup.add(behindLabel);
      }
    }

    // 2. VERTICAL PLANE (VP)
    // Lies in X-Y plane (Z = 0)
    // Above HP, Below HP
    if (showVp) {
      const vpGeo = new THREE.PlaneGeometry(widthX, heightY, 8, 8);
      const vpMat = new THREE.MeshPhysicalMaterial({
        color: vpThreeColor,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: isDark ? 0.38 : 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const vpMesh = new THREE.Mesh(vpGeo, vpMat);
      vpMesh.position.set(centerX, 0, 0);
      vpMesh.receiveShadow = !isSoftwareGlRef.current;
      vpGroup.add(vpMesh);

      // VP Border
      const vpEdges = new THREE.EdgesGeometry(vpGeo);
      const vpLine = new THREE.LineSegments(
        vpEdges,
        new THREE.LineBasicMaterial({
          color: vpThreeColor,
          linewidth: 2,
        })
      );
      vpLine.position.set(centerX, 0, 0);
      vpGroup.add(vpLine);

      // VP Grid
      const vpGridGeo = createRectGridGeometry(widthX, heightY, 20);
      const vpGrid = new THREE.LineSegments(
        vpGridGeo,
        new THREE.LineBasicMaterial({
          color: isDark ? 0x1e293b : 0xe2e8f0,
          transparent: true,
          opacity: 0.75,
        })
      );
      vpGrid.position.set(centerX, 0, -0.05);
      vpGroup.add(vpGrid);

      // Labels on VP
      if (showLabels) {
        const vpLabel = createTextSprite('VP (Vertical Plane)', {
          fontsize: 24,
          textColor: vpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: vpColor,
        });
        vpLabel.position.set(startX + 30, maxVert - 16, 0.5);
        vpGroup.add(vpLabel);

        const aboveLabel = createTextSprite('▲ ABOVE HP', {
          fontsize: 18,
          textColor: vpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: vpColor,
        });
        aboveLabel.position.set(centerX, maxVert - 12, 0.5);
        vpGroup.add(aboveLabel);

        const belowLabel = createTextSprite('▼ BELOW HP', {
          fontsize: 18,
          textColor: vpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: vpColor,
        });
        belowLabel.position.set(centerX, -maxVert + 12, 0.5);
        vpGroup.add(belowLabel);
      }
    }

    // 3. INTERSECTION LINE (REFERENCE LINE X - Y)
    // Thin but distinctively visible XY line
    const extX = 20;
    const groundLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startX - extX, 0, 0),
      new THREE.Vector3(endX + extX, 0, 0),
    ]);
    const groundLineMat = new THREE.LineBasicMaterial({
      color: isDark ? 0xf8fafc : 0x0f172a,
      linewidth: 1.5,
    });
    const groundLine = new THREE.Line(groundLineGeo, groundLineMat);
    vpGroup.add(groundLine);

    // Thin but distinctively visible rod representing XY line
    const rodGeo = new THREE.CylinderGeometry(0.18, 0.18, widthX + extX * 2, 16);
    const rodMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0xf1f5f9 : 0x0f172a,
      roughness: 0.2,
      metalness: 0.9,
    });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(centerX, 0, 0);
    vpGroup.add(rod);

    // End-point labels X and Y
    if (showLabels) {
      const xLabel = createTextSprite('X', {
        fontsize: 28,
        textColor: '#0f172a',
        backgroundColor: '#f1f5f9',
        borderColor: '#475569',
      });
      xLabel.position.set(startX - extX - 10, 0, 0);
      vpGroup.add(xLabel);

      const yLabel = createTextSprite('Y', {
        fontsize: 28,
        textColor: '#0f172a',
        backgroundColor: '#f1f5f9',
        borderColor: '#475569',
      });
      yLabel.position.set(endX + extX + 10, 0, 0);
      vpGroup.add(yLabel);
    }

    // 4. QUADRANT MARKERS IN 3D SPACE
    if (showQuadrants) {
      const quadColors = isDark
        ? ['#60a5fa', '#f87171', '#34d399', '#c084fc']
        : ['#1d4ed8', '#b91c1c', '#047857', '#7e22ce'];

      const quadOffsetVert = Math.min(maxVert * 0.5, 45);
      const quadOffsetDepth = Math.min(maxDepth * 0.5, 45);

      // 1st Quadrant: +Y (up), +Z (front)
      const q1 = createTextSprite('1st Quadrant', {
        fontsize: 18,
        textColor: quadColors[0],
        backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)',
      });
      q1.position.set(startX + 25, quadOffsetVert, quadOffsetDepth);
      vpGroup.add(q1);

      // 2nd Quadrant: +Y (up), -Z (behind)
      const q2 = createTextSprite('2nd Quadrant', {
        fontsize: 18,
        textColor: quadColors[1],
        backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)',
      });
      q2.position.set(startX + 25, quadOffsetVert, -quadOffsetDepth);
      vpGroup.add(q2);

      // 3rd Quadrant: -Y (below), -Z (behind)
      const q3 = createTextSprite('3rd Quadrant', {
        fontsize: 18,
        textColor: quadColors[2],
        backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)',
      });
      q3.position.set(startX + 25, -quadOffsetVert, -quadOffsetDepth);
      vpGroup.add(q3);

      // 4th Quadrant: -Y (below), +Z (front)
      const q4 = createTextSprite('4th Quadrant', {
        fontsize: 18,
        textColor: quadColors[3],
        backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)',
      });
      q4.position.set(startX + 25, -quadOffsetVert, quadOffsetDepth);
      vpGroup.add(q4);
    }

    // Auto-update orbit controls target to center of active planes
    if (controlsRef.current) {
      controlsRef.current.target.set(centerX, 0, 0);
    }
  }, [planeBounds, showHp, showVp, showAxes, showLabels, showQuadrants, isDark, hpColor, vpColor]);

  // Handle HP 90° Clockwise Unfolding
  useEffect(() => {
    if (!foldGroupRef.current) return;
    // Clockwise rotation around X axis:
    // When HP is viewed along -X (from right to left looking at origin),
    // clockwise rotation rotates +Z (in front of VP) downwards to -Y,
    // and -Z (behind VP) upwards to +Y!
    // In Three.js coordinate system (Right Hand Rule along +X):
    // Rotation angle around +X:
    // A positive rotation around +X rotates +Z towards +Y (counter-clockwise).
    // Clockwise rotation (standard engineering drawing convention) rotates +Z downwards towards -Y:
    // Therefore angle = - radians(unfoldAngle)
    const rad = (-unfoldAngle * Math.PI) / 180;
    foldGroupRef.current.rotation.x = rad;
  }, [unfoldAngle]);

  // Render Points, Projections, and Dimension Lines in 3D
  useEffect(() => {
    const pointsGroup = pointsGroupRef.current;
    if (!pointsGroup) return;

    while (pointsGroup.children.length > 0) {
      const obj = pointsGroup.children[0];
      pointsGroup.remove(obj);
    }

    points.forEach((pt) => {
      const isSelected = pt.id === selectedPointId;

      // Coordinate mapping from Engineering to Three.js:
      // X = pt.x
      // Y = pt.z (Height relative to HP: + above, - below)
      // Z = pt.y (Depth relative to VP: + in front, - behind)
      const posX = pt.x;
      const posY = pt.z;
      const posZ = pt.y;

      // 1. Point 3D Mesh (Glowing Sphere with halo ring)
      const pointRoot = new THREE.Group();
      pointRoot.userData = { pointId: pt.id, pointData: pt };

      const sphereGeo = new THREE.SphereGeometry(isSelected ? 3.4 : 2.6, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: pt.color,
        roughness: 0.15,
        metalness: 0.85,
        emissive: pt.color,
        emissiveIntensity: isSelected ? 0.6 : 0.25,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(posX, posY, posZ);
      pointRoot.add(sphere);

      // Selection Halo
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(4.2, 5.0, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: pt.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(posX, posY, posZ);
        ring.lookAt(cameraRef.current ? cameraRef.current.position : new THREE.Vector3(100, 100, 100));
        pointRoot.add(ring);
      }

      // Point Label (A, B, etc.)
      if (showLabels) {
        const pointLabel = createTextSprite(`Point ${pt.name}`, {
          fontsize: 26,
          textColor: pt.color,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: pt.color,
          borderThickness: 2.5,
        });
        pointLabel.position.set(posX, posY + 7, posZ);
        pointRoot.add(pointLabel);
      }

      // 2. PROJECTION ONTO VP (Front View Point a')
      // Projection of point perpendicular to VP lands at (X, Y, 0)
      const fvGeo = new THREE.SphereGeometry(1.9, 24, 24);
      const fvMat = new THREE.MeshStandardMaterial({
        color: vpColor,
        roughness: 0.2,
        metalness: 0.7,
      });
      const fvMesh = new THREE.Mesh(fvGeo, fvMat);
      fvMesh.position.set(posX, posY, 0);
      pointRoot.add(fvMesh);

      if (showLabels) {
        const fvLabel = createTextSprite(pt.frontViewLabel, {
          fontsize: 22,
          textColor: vpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: vpColor,
        });
        fvLabel.position.set(posX + 6, posY + 4, 1);
        pointRoot.add(fvLabel);
      }

      // 3. PROJECTION ONTO HP (Top View Point a)
      // Projection of point perpendicular to HP lands at (X, 0, Z)
      const tvGeo = new THREE.SphereGeometry(1.9, 24, 24);
      const tvMat = new THREE.MeshStandardMaterial({
        color: hpColor,
        roughness: 0.2,
        metalness: 0.7,
      });
      const tvMesh = new THREE.Mesh(tvGeo, tvMat);
      tvMesh.position.set(posX, 0, posZ);
      pointRoot.add(tvMesh);

      if (showLabels) {
        const tvLabel = createTextSprite(pt.topViewLabel, {
          fontsize: 22,
          textColor: hpColor,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: hpColor,
        });
        tvLabel.position.set(posX + 6, 1, posZ + 5);
        pointRoot.add(tvLabel);
      }

      // 4. Ground Line Reference Intersection point (X, 0, 0)
      const refMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: isDark ? 0x94a3b8 : 0x475569 })
      );
      refMesh.position.set(posX, 0, 0);
      pointRoot.add(refMesh);

      // 5. PROJECTOR LINES (Dashed perpendicular lines in 3D)
      if (showProjectors) {
        // Line from Point to VP (perpendicular to VP, along Z)
        const toVpGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(posX, posY, posZ),
          new THREE.Vector3(posX, posY, 0),
        ]);
        const toVpMat = new THREE.LineDashedMaterial({
          color: vpColor,
          dashSize: 2,
          gapSize: 1.5,
          linewidth: 1.5,
        });
        const toVpLine = new THREE.Line(toVpGeo, toVpMat);
        toVpLine.computeLineDistances();
        pointRoot.add(toVpLine);

        // Line from Point to HP (perpendicular to HP, along Y)
        const toHpGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(posX, posY, posZ),
          new THREE.Vector3(posX, 0, posZ),
        ]);
        const toHpMat = new THREE.LineDashedMaterial({
          color: hpColor,
          dashSize: 2,
          gapSize: 1.5,
          linewidth: 1.5,
        });
        const toHpLine = new THREE.Line(toHpGeo, toHpMat);
        toHpLine.computeLineDistances();
        pointRoot.add(toHpLine);

        // Line on VP from Front View point to Ground Line XY: (posX, posY, 0) -> (posX, 0, 0)
        const fvToGroundGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(posX, posY, 0),
          new THREE.Vector3(posX, 0, 0),
        ]);
        const fvToGroundMat = new THREE.LineDashedMaterial({
          color: isDark ? 0x94a3b8 : 0x64748b,
          dashSize: 1.5,
          gapSize: 1.2,
          linewidth: 1.2,
        });
        const fvToGroundLine = new THREE.Line(fvToGroundGeo, fvToGroundMat);
        fvToGroundLine.computeLineDistances();
        pointRoot.add(fvToGroundLine);

        // Line on HP from Top View point to Ground Line XY: (posX, 0, posZ) -> (posX, 0, 0)
        const tvToGroundGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(posX, 0, posZ),
          new THREE.Vector3(posX, 0, 0),
        ]);
        const tvToGroundMat = new THREE.LineDashedMaterial({
          color: isDark ? 0x94a3b8 : 0x64748b,
          dashSize: 1.5,
          gapSize: 1.2,
          linewidth: 1.2,
        });
        const tvToGroundLine = new THREE.Line(tvToGroundGeo, tvToGroundMat);
        tvToGroundLine.computeLineDistances();
        pointRoot.add(tvToGroundLine);
      }

      // 6. DIMENSION ANNOTATIONS IN 3D
      if (showDimensions) {
        // Height from HP (along Y axis)
        if (pt.distHp > 0) {
          const midY = posY / 2;
          const hpDistSprite = createTextSprite(`${pt.distHp} mm`, {
            fontsize: 20,
            textColor: '#0f172a',
            backgroundColor: 'rgba(254, 240, 138, 0.95)', // pale yellow
            borderColor: '#eab308',
          });
          hpDistSprite.position.set(posX - 8, midY, 0);
          pointRoot.add(hpDistSprite);
        }

        // Distance from VP (along Z axis)
        if (pt.distVp > 0) {
          const midZ = posZ / 2;
          const vpDistSprite = createTextSprite(`${pt.distVp} mm`, {
            fontsize: 20,
            textColor: '#0f172a',
            backgroundColor: 'rgba(191, 219, 254, 0.95)', // pale blue
            borderColor: '#3b82f6',
          });
          vpDistSprite.position.set(posX - 8, 0, midZ);
          pointRoot.add(vpDistSprite);
        }
      }

      pointsGroup.add(pointRoot);
    });
  }, [points, selectedPointId, showProjectors, showDimensions, showLabels, isDark, hpColor, vpColor]);

  // Raycasting for point hover/click selection
  useEffect(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const pointsGroup = pointsGroupRef.current;
    if (!container || !renderer || !camera || !pointsGroup) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Check intersection with point objects
      const intersects = raycaster.intersectObjects(pointsGroup.children, true);
      if (intersects.length > 0) {
        let parent = intersects[0].object;
        while (parent && !parent.userData?.pointData && parent.parent) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.pointData) {
          container.style.cursor = 'pointer';
          setHoveredPointInfo({
            point: parent.userData.pointData,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
          });
          return;
        }
      }
      container.style.cursor = 'default';
      setHoveredPointInfo(null);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(pointsGroup.children, true);
      if (intersects.length > 0) {
        let parent = intersects[0].object;
        while (parent && !parent.userData?.pointData && parent.parent) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.pointData && onSelectPoint) {
          onSelectPoint(parent.userData.pointData.id);
        }
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
    };
  }, [points, onSelectPoint]);

  // Preset Camera Views
  const setCameraView = useCallback((view: 'iso' | 'front' | 'top' | 'side') => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    const { centerX, widthX, maxVert, maxDepth } = planeBounds;
    controls.target.set(centerX, 0, 0);

    const dist = Math.max(widthX * 0.9, maxVert * 1.8, maxDepth * 1.8, 160);

    switch (view) {
      case 'iso':
        camera.position.set(centerX + dist * 0.75, dist * 0.55, dist * 0.9);
        break;
      case 'front': // Elevation: Look directly along -Z at the VP (showing X and Height Z)
        camera.position.set(centerX, 0, dist * 1.4);
        break;
      case 'top': // Plan: Look directly from top along -Y at the HP (showing X and Depth Y)
        camera.position.set(centerX, dist * 1.4, 0.001); // tiny epsilon to avoid gimbal lock
        break;
      case 'side': // Side View: Look along X axis
        camera.position.set(centerX + dist * 1.4, 0, 0);
        break;
    }
    controls.update();
  }, [planeBounds]);

  // Animate Unfolding HP
  const handleToggleUnfold = () => {
    if (isAnimatingFold) return;
    setIsAnimatingFold(true);

    const target = unfoldAngle > 45 ? 0 : 90;
    const start = unfoldAngle;
    const duration = 800;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // smooth easeInOut
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;

      const current = start + (target - start) * ease;
      setUnfoldAngle(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setUnfoldAngle(target);
        setIsAnimatingFold(false);
      }
    };

    requestAnimationFrame(step);
  };

  return (
    <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900/5 shadow-inner">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Header Badge & Legend */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 text-xs font-semibold rounded bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
          3D Cartesian Space
        </span>
        <div className="flex items-center gap-3 px-3 py-1 text-xs rounded bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 shadow border border-slate-200 dark:border-slate-800 backdrop-blur-sm pointer-events-auto">
          <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition" title="Click to choose HP Color">
            <span
              className="w-3 h-3 rounded-sm shadow-xs border border-black/10 dark:border-white/10"
              style={{ backgroundColor: hpColor }}
            />
            <span className="font-mono text-[11px] font-medium">HP (Horizontal)</span>
            <input
              type="color"
              value={hpColor}
              onChange={(e) => onChangeHpColor?.(e.target.value)}
              className="sr-only"
            />
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition" title="Click to choose VP Color">
            <span
              className="w-3 h-3 rounded-sm shadow-xs border border-black/10 dark:border-white/10"
              style={{ backgroundColor: vpColor }}
            />
            <span className="font-mono text-[11px] font-medium">VP (Vertical)</span>
            <input
              type="color"
              value={vpColor}
              onChange={(e) => onChangeVpColor?.(e.target.value)}
              className="sr-only"
            />
          </label>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-slate-800 dark:bg-slate-200" />
            <span className="font-mono text-[11px] font-medium">XY (Ground Line)</span>
          </div>
        </div>
      </div>

      {/* Camera View Presets Bar (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow backdrop-blur-sm">
        <button
          onClick={() => setCameraView('iso')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className="px-2.5 py-1 text-sm sm:text-base tracking-wider rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition"
          title="Isometric 3D Projection"
        >
          Isometric
        </button>
        <button
          onClick={() => setCameraView('front')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className="px-2.5 py-1 text-sm sm:text-base tracking-wider rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition"
          title="Front View (Elevation towards VP)"
        >
          Front(VP)
        </button>
        <button
          onClick={() => setCameraView('top')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className="px-2.5 py-1 text-sm sm:text-base tracking-wider rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition"
          title="Top View (Plan onto HP)"
        >
          TOP(HP)
        </button>
        <button
          onClick={() => setCameraView('side')}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className="px-2.5 py-1 text-sm sm:text-base tracking-wider rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition"
          title="Side View"
        >
          side view
        </button>
        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          onClick={() => setCameraView('iso')}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          title="Reset Camera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredPointInfo && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg bg-slate-900/95 text-white text-xs shadow-xl border border-slate-700 font-mono transform -translate-x-1/2 -translate-y-full -mt-2"
          style={{
            left: `${hoveredPointInfo.screenX}px`,
            top: `${hoveredPointInfo.screenY}px`,
          }}
        >
          <div className="font-bold text-amber-300 flex items-center justify-between gap-3">
            <span>Point {hoveredPointInfo.point.name}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {hoveredPointInfo.point.quadrantTitle}
            </span>
          </div>
          <div className="mt-1 space-y-0.5 text-slate-300 text-[11px]">
            <div>
              HP: {hoveredPointInfo.point.hpRelation === 'ON' ? 'On HP' : `${hoveredPointInfo.point.distHp} mm ${hoveredPointInfo.point.hpRelation === 'ABOVE' ? 'Above' : 'Below'}`}
            </div>
            <div>
              VP: {hoveredPointInfo.point.vpRelation === 'ON' ? 'On VP' : `${hoveredPointInfo.point.distVp} mm ${hoveredPointInfo.point.vpRelation === 'IN_FRONT' ? 'In Front' : 'Behind'}`}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Ergonomic Bottom Controls Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[95%] w-auto flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-lg backdrop-blur-md z-10 text-xs">
        {/* Unfolding HP Demonstration Feature */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-700">
          <button
            onClick={handleToggleUnfold}
            disabled={isAnimatingFold}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition shadow-sm ${
              unfoldAngle > 0
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title="Demonstrate 90° Clockwise Rotation of HP to unfold into 2D Orthographic drawing plane"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{unfoldAngle === 0 ? 'Unfold HP 90°' : `Fold Back (${unfoldAngle}°)`}</span>
          </button>
        </div>

        {/* Visibility Toggles */}
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
          <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none">
            <input
              type="checkbox"
              checked={showHp}
              onChange={(e) => setShowHp(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 w-3 h-3"
            />
            <span>HP</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer hover:text-red-600 dark:hover:text-red-400 select-none">
            <input
              type="checkbox"
              checked={showVp}
              onChange={(e) => setShowVp(e.target.checked)}
              className="rounded text-red-600 focus:ring-0 w-3 h-3"
            />
            <span>VP</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white select-none">
            <input
              type="checkbox"
              checked={showProjectors}
              onChange={(e) => setShowProjectors(e.target.checked)}
              className="rounded text-slate-700 focus:ring-0 w-3 h-3"
            />
            <span>Projectors</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white select-none">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => setShowDimensions(e.target.checked)}
              className="rounded text-slate-700 focus:ring-0 w-3 h-3"
            />
            <span>Dimensions</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white select-none">
            <input
              type="checkbox"
              checked={showQuadrants}
              onChange={(e) => setShowQuadrants(e.target.checked)}
              className="rounded text-slate-700 focus:ring-0 w-3 h-3"
            />
            <span>Quadrants</span>
          </label>
        </div>

        {/* Orbit hint */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-sans">
          <span>Drag: rotate • Scroll: zoom • Right-drag: pan</span>
        </div>
      </div>
    </div>
  );
};
