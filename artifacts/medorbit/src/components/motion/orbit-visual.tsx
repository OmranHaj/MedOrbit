import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitPlaceholder } from "./orbit-placeholder";

/** Decorative only: never reads clinic coordinates, reports, or live location. */
export function OrbitVisual({ reducedMotion, paused, onReadyChange }: { reducedMotion: boolean; paused: boolean; onReadyChange: (ready: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);

  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);

  useEffect(() => {
    setReady(false);
    if (reducedMotion || !host.current) return;
    const element = host.current;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
    if (!context) return;
    let active = true;
    let frame = 0;
    let onScreen = true;
    let disposeScene = () => {};
    const resize = new ResizeObserver(() => resizeScene());
    let resizeScene = () => {};
    let drawScene: ((time: number) => void) | undefined;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (active && onScreen && !document.hidden && !pausedRef.current && drawScene) {
        frame = requestAnimationFrame(drawScene);
      }
    };
    syncRef.current = sync;
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    const lost = () => { active = false; cancelAnimationFrame(frame); setReady(false); };
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", sync);
    observer.observe(element);

    try {
      const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
      camera.position.z = 5.6;
      const orbit = new THREE.Group();
      orbit.rotation.z = -0.2;
      scene.add(orbit);
      scene.add(new THREE.AmbientLight(0xb5f5f2, 2.3));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(3, 4, 5);
      scene.add(light);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 2), new THREE.MeshStandardMaterial({
        color: 0x0d9488, emissive: 0x0d9488, emissiveIntensity: 0.22, metalness: 0.55, roughness: 0.3,
      }));
      orbit.add(core);
      const crossMaterial = new THREE.MeshBasicMaterial({ color: 0xe1fffc });
      for (const [width, height] of [[0.14, 0.62], [0.62, 0.14]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), crossMaterial);
        bar.position.z = 0.64;
        orbit.add(bar);
      }
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15 + i * 0.16, 0.012, 6, 96),
          new THREE.MeshBasicMaterial({ color: i === 1 ? 0x80dfdf : 0x20b9a9, transparent: true, opacity: 0.65 }));
        ring.rotation.set(0.65 + i * 0.6, i * 0.65, i * 0.8);
        orbit.add(ring);
      }
      const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xa6fff1 }));
      satellite.position.set(1.3, 0, 0);
      orbit.add(satellite);
      const positions = new Float32Array(48 * 3);
      for (let i = 0; i < 48; i++) {
        const angle = i * 2.39996, radius = 1.48 + (i % 5) * 0.065;
        positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(i * 1.7) * 0.5], i * 3);
      }
      const dots = new THREE.BufferGeometry();
      dots.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      orbit.add(new THREE.Points(dots, new THREE.PointsMaterial({ color: 0x71cfc9, size: 0.018, transparent: true, opacity: 0.5 })));
      disposeScene = () => {
        const geometries = new Set<import("three").BufferGeometry>();
        const materials = new Set<import("three").Material>();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            geometries.add(object.geometry);
            (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
          }
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        renderer.dispose();
      };
      resizeScene = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      element.appendChild(canvas);
      resize.observe(element);
      resizeScene();
      let last = 0, angle = 0;
      drawScene = (time) => {
        frame = requestAnimationFrame(drawScene!);
        if (time - last < 1000 / 30) return;
        const delta = last ? Math.min((time - last) / 1000, 0.06) : 0;
        last = time;
        angle += delta;
        orbit.rotation.y = Math.sin(angle * 0.25) * 0.25;
        orbit.rotation.x = Math.sin(angle * 0.18) * 0.1;
        core.rotation.y += delta * 0.12;
        satellite.position.set(Math.cos(angle * 0.5) * 1.3, Math.sin(angle * 0.5) * 0.75, Math.sin(angle * 0.5) * 0.5);
        renderer.render(scene, camera);
      };
      setReady(true);
      sync();
    } catch {
      // WebGL/module failure must never affect the dashboard or its saved data.
      if (active) setReady(false);
      disposeScene();
    }

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      syncRef.current = () => {};
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", lost);
      disposeScene();
      context.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [reducedMotion]);

  return (
    <div className="orbit-visual" aria-hidden="true" data-webgl-ready={ready} data-testid="intro-orbit-visual">
      <OrbitPlaceholder />
      <div ref={host} className="orbit-webgl" />
    </div>
  );
}
