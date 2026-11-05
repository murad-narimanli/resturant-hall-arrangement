import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Hall, Table } from './model';

export default function View3D({ hall, tables }: { hall: Hall; tables: Table[] }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [error, setError] = useState('');
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError('3D requires WebGL. Please enable hardware acceleration or return to 2D.');
      return;
    }
    setError('');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2ef');
    const width = hall.width / 100,
      length = hall.height / 100;
    const span = Math.max(width, length);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 500);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '3D hall preview');
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = Math.max(1, span * 0.2);
    controls.maxDistance = span * 5;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    reset.current = () => {
      controls.target.set(0, 0.2, 0);
      const distance = span * (container.clientWidth < container.clientHeight ? 1.7 : 0.98);
      camera.position.set(distance * 0.7, distance * 0.85, distance);
      controls.update();
    };
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x788b75, 2.6);
    scene.add(hemisphere);
    const sunlight = new THREE.DirectionalLight(0xfff3df, 3);
    sunlight.position.set(-span * 0.6, span * 1.5, span * 0.5);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -span;
    sunlight.shadow.camera.right = sunlight.shadow.camera.top = span;
    sunlight.shadow.camera.far = span * 5;
    sunlight.shadow.bias = -0.0003;
    scene.add(sunlight);
    const wood = new THREE.MeshStandardMaterial({ color: '#bc9570', roughness: 0.68 });
    const frame = new THREE.MeshStandardMaterial({ color: '#34473b', roughness: 0.65 });
    const upholstery = new THREE.MeshStandardMaterial({ color: '#75a38a', roughness: 0.9 });
    const backMaterial = new THREE.MeshStandardMaterial({ color: '#49795c', roughness: 0.9 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#e4ddd0', roughness: 0.95 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#738b7a', roughness: 0.8 });
    function mesh(
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      parent: THREE.Object3D,
      x = 0,
      y = 0,
      z = 0,
    ) {
      const item = new THREE.Mesh(geometry, material);
      item.position.set(x, y, z);
      item.castShadow = true;
      item.receiveShadow = true;
      parent.add(item);
      return item;
    }
    const box = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
    if (hall.shape === 'circle') {
      mesh(
        new THREE.CylinderGeometry(width / 2, width / 2, 0.12, 96),
        floorMaterial,
        scene,
        0,
        -0.06,
        0,
      );
      const border = mesh(new THREE.TorusGeometry(width / 2, 0.035, 8, 96), edgeMaterial, scene);
      border.rotation.x = Math.PI / 2;
    } else {
      box(scene, width, 0.12, length, 0, -0.06, 0, floorMaterial);
      box(scene, width, 0.08, 0.045, 0, 0.04, -length / 2, edgeMaterial);
      box(scene, width, 0.08, 0.045, 0, 0.04, length / 2, edgeMaterial);
      box(scene, 0.045, 0.08, length, -width / 2, 0.04, 0, edgeMaterial);
      box(scene, 0.045, 0.08, length, width / 2, 0.04, 0, edgeMaterial);
      const lines: number[] = [];
      for (let x = -width / 2 + 0.5; x < width / 2; x += 0.5)
        lines.push(x, 0.003, -length / 2, x, 0.003, length / 2);
      for (let z = -length / 2 + 0.5; z < length / 2; z += 0.5)
        lines.push(-width / 2, 0.003, z, width / 2, 0.003, z);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      scene.add(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: '#ccc9bc', transparent: true, opacity: 0.45 }),
        ),
      );
    }
    function upholsteredShape(
      shape: THREE.Shape,
      parent: THREE.Object3D,
      bottom: number,
      height: number,
      material: THREE.Material,
    ) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 2,
        steps: 1,
        curveSegments: 48,
      });
      const item = mesh(geometry, material, parent, 0, bottom, 0);
      item.rotation.x = -Math.PI / 2;
      return item;
    }
    const furniture = new THREE.Group();
    scene.add(furniture);
    for (const t of tables.filter((t) => t.placed && t.hallId === hall.id)) {
      const group = new THREE.Group();
      group.position.set(t.x / 100 - width / 2, 0, t.y / 100 - length / 2);
      group.rotation.y = -THREE.MathUtils.degToRad(t.rotation);
      group.userData.id = t.id;
      furniture.add(group);
      const w = t.width / 100,
        d = t.height / 100;
      if (t.shape.startsWith('sofa-')) {
        const depth = Math.min(w, d) * 0.32;
        if (t.shape === 'sofa-straight') {
          box(group, w, 0.18, d, 0, 0.32, 0, upholstery);
          box(group, w, 0.45, d * 0.21, 0, 0.62, -d * 0.395, backMaterial);
          box(group, w * 0.09, 0.35, d, -w * 0.455, 0.5, 0, backMaterial);
          box(group, w * 0.09, 0.35, d, w * 0.455, 0.5, 0, backMaterial);
          for (const x of [-w / 3, 0, w / 3])
            box(group, w / 3 - 0.035, 0.08, d * 0.64, x, 0.45, d * 0.04, upholstery);
        } else if (t.shape === 'sofa-corner') {
          box(group, w, 0.2, depth, 0, 0.32, -d / 2 + depth / 2, upholstery);
          box(group, depth, 0.2, d, -w / 2 + depth / 2, 0.32, 0, upholstery);
          box(group, w, 0.45, 0.12, 0, 0.62, -d / 2 + 0.06, backMaterial);
          box(group, 0.12, 0.45, d, -w / 2 + 0.06, 0.62, 0, backMaterial);
        } else {
          const shape = new THREE.Shape();
          const full = t.shape === 'sofa-circle';
          shape.absellipse(0, 0, w / 2, d / 2, 0, full ? Math.PI * 2 : Math.PI, false, 0);
          if (full) {
            const hole = new THREE.Path();
            hole.absellipse(
              0,
              0,
              Math.max(0.1, w / 2 - depth),
              Math.max(0.1, d / 2 - depth),
              0,
              Math.PI * 2,
              true,
              0,
            );
            shape.holes.push(hole);
          } else {
            shape.lineTo(-w / 2 + depth, 0);
            shape.absellipse(
              0,
              0,
              Math.max(0.1, w / 2 - depth),
              Math.max(0.1, d / 2 - depth),
              Math.PI,
              0,
              true,
              0,
            );
            shape.closePath();
          }
          upholsteredShape(shape, group, 0.2, 0.28, upholstery);
          const back = new THREE.Shape();
          back.absellipse(0, 0, w / 2, d / 2, 0, full ? Math.PI * 2 : Math.PI, false, 0);
          if (full) {
            const hole = new THREE.Path();
            hole.absellipse(0, 0, w / 2 - 0.1, d / 2 - 0.1, 0, Math.PI * 2, true, 0);
            back.holes.push(hole);
          } else {
            back.lineTo(-w / 2 + 0.1, 0);
            back.absellipse(0, 0, w / 2 - 0.1, d / 2 - 0.1, Math.PI, 0, true, 0);
            back.closePath();
          }
          upholsteredShape(back, group, 0.47, 0.32, backMaterial);
        }
      } else {
        if (t.shape === 'circle')
          mesh(
            new THREE.CylinderGeometry(w / 2, w / 2, 0.07, 64),
            wood,
            group,
            0,
            0.76,
            0,
          ).scale.z = d / w;
        else if (t.shape === 'organic') {
          const shape = new THREE.Shape();
          shape.moveTo(-0.47, 0.23);
          shape.bezierCurveTo(-0.55, 0.55, -0.05, 0.58, 0.13, 0.39);
          shape.bezierCurveTo(0.44, 0.6, 0.62, 0.2, 0.44, -0.05);
          shape.bezierCurveTo(0.65, -0.39, 0.2, -0.59, -0.02, -0.39);
          shape.bezierCurveTo(-0.36, -0.6, -0.65, -0.2, -0.44, 0);
          shape.bezierCurveTo(-0.6, 0.1, -0.52, 0.18, -0.47, 0.23);
          const item = upholsteredShape(shape, group, 0.72, 0.06, wood);
          item.scale.set(w, d, 1);
        } else box(group, w, 0.07, d, 0, 0.76, 0, wood);
        for (const x of [-w * 0.32, w * 0.32])
          for (const z of [-d * 0.3, d * 0.3]) box(group, 0.055, 0.72, 0.055, x, 0.36, z, frame);
        for (const c of t.chairs) {
          const chair = new THREE.Group();
          chair.position.set(c.x / 100, 0, c.y / 100);
          chair.rotation.y = -THREE.MathUtils.degToRad(c.rotation);
          group.add(chair);
          const cw = (c.width ?? 34) / 100,
            ch = (c.height ?? 34) / 100;
          box(chair, cw, 0.085, ch, 0, 0.44, 0, upholstery);
          box(chair, cw, 0.38, 0.065, 0, 0.65, -ch / 2 + 0.025, backMaterial);
          for (const x of [-cw * 0.35, cw * 0.35])
            for (const z of [-ch * 0.35, ch * 0.35])
              box(chair, 0.032, 0.4, 0.032, x, 0.2, z, frame);
        }
      }
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512;
      labelCanvas.height = 96;
      const ctx = labelCanvas.getContext('2d')!;
      ctx.font = '600 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#173d29';
      ctx.fillText(t.name.slice(0, 32), 256, 54, 490);
      const texture = new THREE.CanvasTexture(labelCanvas),
        label = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
        );
      label.position.y = t.shape.startsWith('sofa-') ? 1.05 : 1.02;
      label.scale.set(1.8, 0.34, 1);
      group.add(label);
    }
    container.dataset.furnitureCount = String(
      tables.filter((t) => t.placed && t.hallId === hall.id).length,
    );
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    reset.current();
    let frameId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      container.dataset.ready = 'true';
      frameId = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        const item = o as THREE.Mesh;
        if (item.geometry) geometries.add(item.geometry);
        if (item.material)
          (Array.isArray(item.material) ? item.material : [item.material]).forEach((m) =>
            materials.add(m),
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        const map = (m as THREE.MeshStandardMaterial).map;
        map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      delete container.dataset.ready;
    };
  }, [hall, tables]);
  return (
    <div className="three-view">
      <div ref={host} className="three-scene" />
      {error ? (
        <div className="three-error">{error}</div>
      ) : (
        <>
          <div className="three-caption">
            <b>{hall.name}</b>
            <span>3D preview · Changes are made in 2D</span>
          </div>
          <div className="three-help">Drag to orbit · Scroll to zoom · Right-drag to pan</div>
          <button className="three-reset" onClick={() => reset.current()}>
            Reset view
          </button>
        </>
      )}
    </div>
  );
}
