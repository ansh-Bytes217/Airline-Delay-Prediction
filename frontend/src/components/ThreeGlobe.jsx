import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const HUBS = [
  { name: 'ATL', lat: 33.6407, lon: -84.4277 },
  { name: 'LAX', lat: 33.9416, lon: -118.4085 },
  { name: 'JFK', lat: 40.6413, lon: -73.7781 },
  { name: 'ORD', lat: 41.9742, lon: -87.9073 },
  { name: 'DFW', lat: 32.8998, lon: -97.0403 },
  { name: 'SFO', lat: 37.6213, lon: -122.3790 },
  { name: 'LHR', lat: 51.4700, lon: -0.4543 },
  { name: 'HND', lat: 35.5494, lon: 139.7798 },
  { name: 'SYD', lat: -33.9461, lon: 151.1772 },
  { name: 'DXB', lat: 25.2532, lon: 55.3657 },
  { name: 'CDG', lat: 49.0097, lon: 2.5479 },
  { name: 'SIN', lat: 1.3644, lon: 103.9915 }
];

const FLIGHTS = [
  { from: 'JFK', to: 'LHR', speed: 0.15 },
  { from: 'LAX', to: 'JFK', speed: 0.2 },
  { from: 'SFO', to: 'HND', speed: 0.12 },
  { from: 'LHR', to: 'DXB', speed: 0.14 },
  { from: 'ORD', to: 'CDG', speed: 0.13 },
  { from: 'DXB', to: 'SIN', speed: 0.11 },
  { from: 'SYD', to: 'LAX', speed: 0.08 },
  { from: 'ATL', to: 'DFW', speed: 0.25 },
  { from: 'DFW', to: 'SFO', speed: 0.22 },
  { from: 'SIN', to: 'HND', speed: 0.16 },
  { from: 'CDG', to: 'LHR', speed: 0.3 }
];

function convertLatLngToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.sin(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);
  return new THREE.Vector3(x, y, z);
}

export default function ThreeGlobe() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 450;
    const height = containerRef.current.clientHeight || 450;

    // ── 1. Scene Setup ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.025);

    // ── 2. Camera Setup ───────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 12;

    // ── 3. Renderer Setup ─────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // ── 4. Globe Groups & Meshes ──────────────────────────────────────────────
    const globeRadius = 3.5;
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Outer Glow / Atmosphere mesh
    const atmosphereGeo = new THREE.SphereGeometry(globeRadius + 0.15, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    globeGroup.add(atmosphere);

    // Wireframe Outer Earth
    const earthGeo = new THREE.SphereGeometry(globeRadius, 36, 36);
    const earthMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    const earthWire = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthWire);

    // Solid inner core (blocks back-side arcs for depth)
    const coreGeo = new THREE.SphereGeometry(globeRadius - 0.05, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(core);

    // ── 5. Add Airport Hubs ──────────────────────────────────────────────────
    const hubPoints = {};
    HUBS.forEach((hub) => {
      const pos = convertLatLngToVector3(hub.lat, hub.lon, globeRadius);
      hubPoints[hub.name] = pos;

      // Outer halo ring for airports
      const ringGeo = new THREE.RingGeometry(0.06, 0.1, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(0, 0, 0); // Orient flat against the sphere
      globeGroup.add(ring);

      // Core airport node dot
      const dotGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      globeGroup.add(dot);
    });

    // ── 6. Flight Arcs & Animated Planes ──────────────────────────────────────
    const activeFlights = [];

    FLIGHTS.forEach((flight) => {
      const p1 = hubPoints[flight.from];
      const p2 = hubPoints[flight.to];
      if (!p1 || !p2) return;

      // Compute Quadratic Bezier Curve
      const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      const arcHeight = globeRadius + dist * 0.35;
      const controlPoint = midPoint.normalize().multiplyScalar(arcHeight);

      const curve = new THREE.QuadraticBezierCurve3(p1, controlPoint, p2);
      
      // Draw flight line
      const points = curve.getPoints(30);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x4f46e5,
        transparent: true,
        opacity: 0.35
      });
      const line = new THREE.Line(lineGeo, lineMat);
      globeGroup.add(line);

      // Create glowing flight passenger plane (represented by animated sphere)
      const planeGeo = new THREE.SphereGeometry(0.05, 8, 8);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.95
      });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      globeGroup.add(plane);

      activeFlights.push({
        plane,
        curve,
        progress: Math.random(), // Random initial offset
        speed: flight.speed * 0.005 + 0.001
      });
    });

    // ── 7. Stars / Particle Background ────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Random coordinates in space
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2 * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const dist = 12 + Math.random() * 8; // Distant shell

      starPositions[i] = dist * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = dist * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = dist * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0x818cf8,
      size: 0.06,
      transparent: true,
      opacity: 0.75
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);

    // ── 8. Interaction / Drag & Drag Physics ──────────────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let dragVelocity = { x: 0.003, y: 0.001 }; // Initial spinning motion

    const onMouseDown = () => {
      isDragging = true;
    };

    const onMouseMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaMove = {
        x: clientX - previousMousePosition.x,
        y: clientY - previousMousePosition.y
      };

      if (isDragging) {
        // Drag turns the globe group
        globeGroup.rotation.y += deltaMove.x * 0.005;
        globeGroup.rotation.x += deltaMove.y * 0.005;
        dragVelocity = {
          x: deltaMove.x * 0.005,
          y: deltaMove.y * 0.005
        };
      }

      previousMousePosition = {
        x: clientX,
        y: clientY
      };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Attach listeners
    const element = containerRef.current;
    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    element.addEventListener('touchstart', onMouseDown, { passive: true });
    window.addEventListener('touchmove', onMouseMove, { passive: true });
    window.addEventListener('touchend', onMouseUp, { passive: true });

    // ── 9. Animation Loop ─────────────────────────────────────────────────────
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate starfield slowly
      starfield.rotation.y += 0.0003;

      // Decelerating rotation simulation (inertia)
      if (!isDragging) {
        globeGroup.rotation.y += dragVelocity.x;
        globeGroup.rotation.x += dragVelocity.y;
        dragVelocity.x *= 0.95;
        dragVelocity.y *= 0.95;

        // Maintain small perpetual rotation
        globeGroup.rotation.y += 0.001;
      }

      // Constrain rotation on X to prevent upside down flips
      globeGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, globeGroup.rotation.x));

      // Update plane animations
      activeFlights.forEach((flight) => {
        flight.progress += flight.speed;
        if (flight.progress > 1) {
          flight.progress = 0;
        }
        const pos = flight.curve.getPointAt(flight.progress);
        flight.plane.position.copy(pos);

        // Subtly scale plane near hubs to mock taking off / landing
        const scaleVal = Math.sin(flight.progress * Math.PI) * 0.8 + 0.2;
        flight.plane.scale.set(scaleVal, scaleVal, scaleVal);
      });

      renderer.render(scene, camera);
    };

    animate();

    // ── 10. Handle Resize ─────────────────────────────────────────────────────
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // ── 11. Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      element.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('touchstart', onMouseDown);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Dispose resources
      scene.clear();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: 'grab'
      }}
      className="three-globe-container"
    />
  );
}

// Globe particles array optimization
