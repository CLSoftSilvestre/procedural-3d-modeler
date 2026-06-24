import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GeometryData } from '@/geometry/GeometryData';
import { toBufferGeometry } from '@/geometry/GeometryData';
import { defaultMaterialSpec, toThreeMaterial, type MaterialSpec } from '@/material/MaterialData';
import { DEFAULT_LIGHTING, type Lighting } from './lighting';

interface ViewportProps {
  geometry: GeometryData | null;
  material: MaterialSpec | null;
  wireframe?: boolean;
  showGrid?: boolean;
  lighting?: Lighting;
}

/**
 * three.js viewport. Owns the scene/camera/renderer imperatively; React only feeds it
 * the evaluated geometry. We dogfood three.js here — it is the target runtime.
 */
export function Viewport({
  geometry,
  material,
  wireframe = false,
  showGrid = true,
  lighting = DEFAULT_LIGHTING,
}: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const keyRef = useRef<THREE.DirectionalLight | null>(null);
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

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
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
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
      controls.dispose();
      envTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Update the displayed mesh whenever geometry changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
      meshRef.current = null;
    }

    if (geometry) {
      const mat = toThreeMaterial(material ?? defaultMaterialSpec()) as THREE.MeshStandardMaterial;
      mat.side = THREE.DoubleSide; // procedural meshes can have open faces
      if (wireframe) mat.wireframe = true;
      const mesh = new THREE.Mesh(toBufferGeometry(geometry), mat);
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
}
