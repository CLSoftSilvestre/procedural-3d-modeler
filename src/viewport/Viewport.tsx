import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GeometryData } from '@/geometry/GeometryData';
import { toBufferGeometry } from '@/geometry/GeometryData';
import { defaultMaterialSpec, toThreeMaterial, type MaterialSpec } from '@/material/MaterialData';
import { DEFAULT_LIGHTING, type Lighting } from './lighting';

/** A transform expressed as the node's transform sockets (rotation in degrees). */
export interface GizmoTransform {
  t: [number, number, number];
  r: [number, number, number];
  s: [number, number, number];
}

export type GizmoMode = 'translate' | 'rotate' | 'scale';

interface ViewportProps {
  geometry: GeometryData | null;
  material: MaterialSpec | null;
  wireframe?: boolean;
  showGrid?: boolean;
  lighting?: Lighting;
  /** Show the transform gizmo at this transform, or null to hide it. */
  gizmo?: GizmoTransform | null;
  gizmoMode?: GizmoMode;
  onGizmoStart?: () => void;
  onGizmoChange?: (next: GizmoTransform) => void;
  onGizmoEnd?: () => void;
}

/** Imperative API exposed to parents (e.g. for capturing a screenshot). */
export interface ViewportHandle {
  /** Render the current frame and return it as a PNG data URL, or null if unavailable. */
  capturePNG: () => string | null;
}

/**
 * three.js viewport. Owns the scene/camera/renderer imperatively; React only feeds it
 * the evaluated geometry. We dogfood three.js here — it is the target runtime.
 */
export const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(
  {
    geometry,
    material,
    wireframe = false,
    showGrid = true,
    lighting = DEFAULT_LIGHTING,
    gizmo = null,
    gizmoMode = 'translate',
    onGizmoStart,
    onGizmoChange,
    onGizmoEnd,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const keyRef = useRef<THREE.DirectionalLight | null>(null);
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const tControlsRef = useRef<TransformControls | null>(null);
  const tHelperRef = useRef<THREE.Object3D | null>(null);
  const proxyRef = useRef<THREE.Object3D | null>(null);
  const draggingRef = useRef(false);
  // Keep latest gizmo callbacks reachable from the once-created event listeners.
  const cbRef = useRef({ onGizmoStart, onGizmoChange, onGizmoEnd });
  cbRef.current = { onGizmoStart, onGizmoChange, onGizmoEnd };

  // Capture: render synchronously (so the drawing buffer is valid) then read it.
  useImperativeHandle(ref, () => ({
    capturePNG: () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;
      // Hide the transform gizmo so it isn't baked into the screenshot.
      const helper = tHelperRef.current;
      const prev = helper?.visible ?? false;
      if (helper) helper.visible = false;
      renderer.clear();
      renderer.render(scene, camera); // scene only — exclude the view gizmo from the capture
      const url = renderer.domElement.toDataURL('image/png');
      if (helper) helper.visible = prev;
      return url;
    },
  }));

  // Set up the scene once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(3, 3, 4);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      // WebGL unavailable: show a message instead of crashing the whole app.
      console.error('WebGL initialization failed:', err);
      const msg = document.createElement('div');
      msg.className = 'viewport__nowebgl';
      msg.textContent = 'WebGL is not available in this browser/context.';
      mount.appendChild(msg);
      sceneRef.current = null;
      return () => {
        mount.removeChild(msg);
      };
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Image-based lighting so PBR materials (esp. metals/glass) are lit & reflective.
    // The ambient slider scales scene.environmentIntensity, so it affects every material.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Transform gizmo: drives an invisible proxy whose decomposed TRS is reported back to
    // the selected node's transform sockets. The proxy is positioned by the gizmo sync effect.
    const proxy = new THREE.Object3D();
    proxy.rotation.order = 'XYZ'; // matches composeMatrix's Euler order
    scene.add(proxy);
    proxyRef.current = proxy;

    const tControls = new TransformControls(camera, renderer.domElement);
    const tHelper = tControls.getHelper();
    scene.add(tHelper);
    tControlsRef.current = tControls;
    tHelperRef.current = tHelper;

    const radToDeg = THREE.MathUtils.radToDeg;
    const reportChange = () => {
      const e = new THREE.Euler().setFromQuaternion(proxy.quaternion, 'XYZ');
      cbRef.current.onGizmoChange?.({
        t: [proxy.position.x, proxy.position.y, proxy.position.z],
        r: [radToDeg(e.x), radToDeg(e.y), radToDeg(e.z)],
        s: [proxy.scale.x, proxy.scale.y, proxy.scale.z],
      });
    };
    const onDraggingChanged = (e: { value: boolean }) => {
      draggingRef.current = e.value;
      controls.enabled = !e.value; // don't orbit while dragging the gizmo
      if (e.value) cbRef.current.onGizmoStart?.();
      else cbRef.current.onGizmoEnd?.();
    };
    tControls.addEventListener('objectChange', reportChange);
    tControls.addEventListener('dragging-changed', onDraggingChanged as never);

    // Interactive view-navigation gizmo (corner axis cube): click an axis to snap to
    // top/bottom/front/back/left/right, like a CAD viewport. It draws over the scene, so
    // disable auto-clear and clear manually each frame.
    const viewHelper = new ViewHelper(camera, renderer.domElement);
    renderer.autoClear = false;
    const onPointerUp = (e: PointerEvent) => viewHelper.handleClick(e);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const grid = new THREE.GridHelper(10, 10, 0x444450, 0x2a2a30);
    gridRef.current = grid;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(1.5));

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 10, 7);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-5, 2, -5);
    scene.add(ambient, key, fill);
    ambientRef.current = ambient;
    keyRef.current = key;
    fillRef.current = fill;

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (viewHelper.animating) viewHelper.update(delta);
      controls.update();
      renderer.clear();
      renderer.render(scene, camera);
      viewHelper.render(renderer); // gizmo overlay (restores the viewport itself)
    };
    animate();

    const onResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      tControls.removeEventListener('objectChange', reportChange);
      tControls.removeEventListener('dragging-changed', onDraggingChanged as never);
      tControls.detach();
      tControls.disconnect();
      // NB: tControls.dispose() is broken in this three build (it calls this.traverse on a
      // non-Object3D Controls), so free the helper's GPU resources ourselves.
      scene.remove(tHelper);
      tHelper.traverse((child) => {
        const obj = child as THREE.Mesh;
        obj.geometry?.dispose();
        const m = obj.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      });
      viewHelper.dispose();
      controls.dispose();
      envTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      tControlsRef.current = null;
      tHelperRef.current = null;
      proxyRef.current = null;
    };
  }, []);

  // Sync the gizmo to the selected node's transform + mode. Skipped while dragging so the
  // user's interaction isn't fought by the re-evaluated values flowing back in.
  useEffect(() => {
    const control = tControlsRef.current;
    const proxy = proxyRef.current;
    if (!control || !proxy) return;
    if (!gizmo) {
      control.detach();
      return;
    }
    control.setMode(gizmoMode);
    if (draggingRef.current) return;
    const d2r = THREE.MathUtils.degToRad;
    proxy.position.set(gizmo.t[0], gizmo.t[1], gizmo.t[2]);
    proxy.rotation.set(d2r(gizmo.r[0]), d2r(gizmo.r[1]), d2r(gizmo.r[2]));
    proxy.scale.set(gizmo.s[0], gizmo.s[1], gizmo.s[2]);
    proxy.updateMatrixWorld();
    control.attach(proxy);
  }, [gizmo, gizmoMode]);

  // Update the displayed mesh whenever geometry changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      const m = meshRef.current.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
      meshRef.current = null;
    }

    if (geometry) {
      const prep = (spec: MaterialSpec) => {
        const m = toThreeMaterial(spec) as THREE.MeshStandardMaterial;
        m.side = THREE.DoubleSide; // procedural meshes can have open faces
        if (wireframe) m.wireframe = true;
        return m;
      };
      // Multi-material (assemblies / painted parts) → material array indexed by geometry groups.
      const meshMat =
        geometry.materials && geometry.materials.length
          ? geometry.materials.map(prep)
          : prep(material ?? defaultMaterialSpec());
      const mesh = new THREE.Mesh(toBufferGeometry(geometry), meshMat);
      scene.add(mesh);
      meshRef.current = mesh;
    }
  }, [geometry, material, wireframe]);

  // Toggle grid visibility without rebuilding the scene.
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  // Apply lighting + background without rebuilding the scene.
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) scene.environmentIntensity = lighting.ambient; // ambient = IBL strength
    if (ambientRef.current) ambientRef.current.intensity = lighting.ambient * 0.25;
    if (keyRef.current) keyRef.current.intensity = lighting.key;
    if (fillRef.current) fillRef.current.intensity = lighting.key * 0.4;
    if (scene?.background instanceof THREE.Color) {
      scene.background.set(lighting.background);
    }
  }, [lighting]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
});
