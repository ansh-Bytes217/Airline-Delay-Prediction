import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { API_BASE } from '../config';

// Global simulated fallback flights spread across the world
const SIMULATED_FLIGHTS = Array.from({ length: 200 }, (_, i) => ({
  icao24: `sim${i}`,
  callsign: ['AAL','DAL','UAL','BAW','AFR','DLH','UAE','SIA','QFA','CCA','JAL','KLM','THY','QTR','ANA'][i % 15] + (100 + i * 7),
  lat: parseFloat((-60 + (i * 2.47) % 140).toFixed(4)),
  lon: parseFloat((-180 + (i * 3.71) % 360).toFixed(4)),
  altitude: Math.round(15000 + (i * 1234) % 25000),
  speed: Math.round(350 + (i * 17) % 200),
  heading: Math.round((i * 53) % 360),
  country: ['United States','United Kingdom','Germany','France','UAE','Australia','Japan','China','India','Brazil','Canada','Singapore','Turkey','Qatar'][i % 14],
  on_ground: false,
}));

const REGION_CENTERS = {
  world:    { lat: 20, lon: 10, zoom: 9.0 },
  northAm:  { lat: 40, lon: -100, zoom: 6.0 },
  europe:   { lat: 50, lon: 15, zoom: 5.5 },
  asia:     { lat: 35, lon: 100, zoom: 6.0 },
  mideast:  { lat: 25, lon: 45, zoom: 5.5 },
  oceania:  { lat: -25, lon: 135, zoom: 6.0 },
  southAm:  { lat: -20, lon: -60, zoom: 6.0 },
  africa:   { lat: 0, lon: 20, zoom: 6.0 },
};

const COUNTRY_FLAGS = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪',
  'France': '🇫🇷', 'UAE': '🇦🇪', 'Australia': '🇦🇺', 'Japan': '🇯🇵',
  'China': '🇨🇳', 'India': '🇮🇳', 'Brazil': '🇧🇷', 'Canada': '🇨🇦',
  'Singapore': '🇸🇬', 'Turkey': '🇹🇷', 'Qatar': '🇶🇦', 'Netherlands': '🇳🇱',
  'Spain': '🇪🇸', 'Italy': '🇮🇹', 'South Korea': '🇰🇷', 'Russia': '🇷🇺',
};

// Major global airports for route drawing
const AIRPORT_COORDS = {
  // North America
  ATL:[33.6407,-84.4277], ORD:[41.9742,-87.9073], DFW:[32.8998,-97.0403],
  LAX:[33.9416,-118.4085], JFK:[40.6413,-73.7781], MIA:[25.7959,-80.287],
  YYZ:[43.6777,-79.6248], MEX:[19.4363,-99.0721],
  // Europe
  LHR:[51.4775,-0.4614], CDG:[49.0097,2.5479], FRA:[50.0379,8.5622],
  AMS:[52.3086,4.7639], MAD:[40.4936,-3.5668], FCO:[41.8003,12.2389],
  IST:[41.2608,28.7418], ZRH:[47.4647,8.5492],
  // Middle East & Africa
  DXB:[25.2532,55.3657], DOH:[25.2731,51.6082], JNB:[-26.1367,28.246],
  CAI:[30.1219,31.4056],
  // Asia Pacific
  SIN:[1.3644,103.9915], HKG:[22.308,113.9185], NRT:[35.7647,140.3864],
  PEK:[40.0799,116.6031], SYD:[-33.9461,151.177], BOM:[19.0896,72.8656],
  DEL:[28.5562,77.1],   BKK:[13.6811,100.7475],
  // South America
  GRU:[-23.4356,-46.4731], GIG:[-22.8099,-43.2505], EZE:[-34.8222,-58.5358],
};

const CONTINENTS = [
  // North America
  [[-168, 65], [-120, 68], [-80, 68], [-60, 60], [-55, 48], [-80, 25], [-98, 15], [-80, 8], [-77, 8], [-82, 10], [-99, 16], [-105, 20], [-110, 23], [-115, 32], [-125, 48], [-140, 60], [-160, 60]],
  // South America
  [[-78, 8], [-72, 10], [-60, 5], [-50, -5], [-35, -7], [-40, -20], [-60, -50], [-70, -55], [-75, -50], [-73, -40], [-72, -30], [-80, -15], [-81, -5]],
  // Africa
  [[-17, 32], [-5, 36], [10, 37], [25, 32], [34, 31], [33, 27], [51, 11], [46, -20], [34, -34], [18, -34], [10, -5], [10, 5], [-15, 15]],
  // Eurasia
  [[-10, 60], [20, 70], [60, 70], [100, 75], [140, 70], [170, 65], [180, 60], [170, 45], [140, 35], [120, 22], [105, 20], [95, 10], [80, 8], [75, 12], [73, 25], [50, 25], [40, 15], [35, 30], [27, 40], [-10, 40]],
  // Australia
  [[113, -25], [115, -34], [130, -32], [138, -35], [143, -38], [150, -34], [151, -22], [142, -10], [136, -12], [128, -22]],
  // Greenland
  [[-70, 75], [-60, 80], [-20, 80], [-35, 60], [-45, 60]],
  // India (Sub-peninsula outline)
  [[68, 23], [73, 25], [78, 23], [78, 10], [77, 8], [72, 20]]
];

const GLOBE_RADIUS = 4.0;

function latLonToVector3(lat, lon, radius) {
  const phi = (lat * Math.PI) / 180;
  const theta = (-lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta)
  );
}

export default function RadarPage() {
  const mapRef = useRef(null);
  
  // ThreeJS Refs
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const flightGroupRef = useRef(null);
  const routeGroupRef = useRef(null);
  const airportGroupRef = useRef(null);
  const requestRef = useRef(null);
  
  // Animation tweening state
  const cameraAnimRef = useRef(null);
  const hoveredMeshRef = useRef(null);

  // React state
  const [flights, setFlights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [flightCount, setFlightCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRoute, setPendingRoute] = useState(null);
  const [region, setRegion] = useState('world');
  const [countryFilter, setCountryFilter] = useState('');
  const [tooltip, setTooltip] = useState(null);

  // Deterministically map flight callsigns to origin/dest airports for 3D trajectory visualization
  const getDeterministicRoute = useCallback((callsign) => {
    const keys = Object.keys(AIRPORT_COORDS);
    if (keys.length < 2) return null;
    let hash = 0;
    for (let i = 0; i < callsign.length; i++) {
      hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    const fromIdx = hash % keys.length;
    let toIdx = (hash + 7) % keys.length;
    if (fromIdx === toIdx) toIdx = (toIdx + 1) % keys.length;
    return { from: keys[fromIdx], to: keys[toIdx] };
  }, []);

  // Listen for global flight trajectory events from other pages
  useEffect(() => {
    const handler = e => setPendingRoute(e.detail);
    window.addEventListener('skypredict:route', handler);
    return () => window.removeEventListener('skypredict:route', handler);
  }, []);

  // Fetch flights from API or fallback
  const fetchFlights = async () => {
    try {
      const res = await fetch(`${API_BASE}/flights`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.flights?.length) {
          setFlights(data.flights);
          setFlightCount(data.flights.length);
          setTotalCount(data.count);
          setIsLive(data.source === 'opensky');
          return data.flights;
        }
      }
    } catch (e) { console.warn('Spring Boot /flights error:', e.message); }
    setFlights(SIMULATED_FLIGHTS);
    setFlightCount(SIMULATED_FLIGHTS.length);
    setTotalCount(SIMULATED_FLIGHTS.length);
    setIsLive(false);
    return SIMULATED_FLIGHTS;
  };

  // Draw 3D glowing flight path arcs
  const draw3DRoute = useCallback((fromCode, toCode) => {
    const scene = sceneRef.current;
    const routeGroup = routeGroupRef.current;
    if (!scene || !routeGroup) return;

    // Clear old lines
    routeGroup.clear();

    const fromCoord = AIRPORT_COORDS[fromCode];
    const toCoord = AIRPORT_COORDS[toCode];
    if (!fromCoord || !toCoord) return;

    const startVec = latLonToVector3(fromCoord[0], fromCoord[1], GLOBE_RADIUS);
    const endVec = latLonToVector3(toCoord[0], toCoord[1], GLOBE_RADIUS);

    // Calculate arc curve (raise midpoint above Earth)
    const midVec = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const dist = startVec.distanceTo(endVec);
    const height = GLOBE_RADIUS + dist * 0.25;
    midVec.normalize().multiplyScalar(height);

    const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b, // glowing gold
      linewidth: 3,
      transparent: true,
      opacity: 0.9
    });

    const routeLine = new THREE.Line(geometry, lineMat);
    routeGroup.add(routeLine);

    // Green origin beacon
    const originMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    originMesh.position.copy(startVec);
    routeGroup.add(originMesh);

    // Red destination beacon
    const destMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    destMesh.position.copy(endVec);
    routeGroup.add(destMesh);

    // Animate camera to focus on the midpoint of the route arc
    const camTarget = midVec.clone().normalize().multiplyScalar(GLOBE_RADIUS + dist * 1.5 + 2.0);
    cameraAnimRef.current = {
      startCameraPos: cameraRef.current.position.clone(),
      startControlsTarget: controlsRef.current.target.clone(),
      targetCameraPos: camTarget,
      targetControlsTarget: midVec.clone().normalize().multiplyScalar(GLOBE_RADIUS),
      duration: 1.5,
      elapsed: 0
    };
  }, []);

  // Handle external pending routes
  useEffect(() => {
    if (pendingRoute && sceneRef.current) {
      draw3DRoute(pendingRoute.from, pendingRoute.to);
      setPendingRoute(null);
    }
  }, [pendingRoute, draw3DRoute]);

  // Center on region
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const center = REGION_CENTERS[region];
    if (center) {
      const targetCamPos = latLonToVector3(center.lat, center.lon, GLOBE_RADIUS + center.zoom);
      cameraAnimRef.current = {
        startCameraPos: camera.position.clone(),
        startControlsTarget: controls.target.clone(),
        targetCameraPos: targetCamPos,
        targetControlsTarget: new THREE.Vector3(0, 0, 0), // center of globe
        duration: 1.2,
        elapsed: 0
      };
    }
  }, [region]);

  // Sync flight positions onto the 3D globe
  const updateFlightMeshes = useCallback((flightList, selectedIcao) => {
    const flightGroup = flightGroupRef.current;
    if (!flightGroup) return;

    // Clear old flights
    flightGroup.clear();

    const coneGeom = new THREE.ConeGeometry(0.04, 0.12, 4);
    coneGeom.rotateX(Math.PI / 2); // align cone forward with Z axis

    flightList.forEach(f => {
      const isSelected = f.icao24 === selectedIcao;
      const color = isSelected ? 0xf59e0b : 0x6366f1; // gold if selected, indigo if not
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.75
      });
      
      const mesh = new THREE.Mesh(coneGeom, material);
      const pos = latLonToVector3(f.lat, f.lon, GLOBE_RADIUS + 0.04);
      mesh.position.copy(pos);

      // Align local Y axis with sphere normal (stand upright on surface)
      const normal = pos.clone().normalize();
      const localUp = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(localUp, normal);

      // Rotate around the normal axis by the heading angle
      const headingRad = ((360 - f.heading) * Math.PI) / 180;
      const headingRotation = new THREE.Quaternion().setFromAxisAngle(normal, headingRad);
      mesh.quaternion.premultiply(headingRotation);

      mesh.userData = { flight: f };
      flightGroup.add(mesh);
    });
  }, []);

  // Sync flight meshes when flights or selection state changes
  useEffect(() => {
    updateFlightMeshes(flights, selected?.icao24 || null);
  }, [flights, selected, updateFlightMeshes]);

  // Select flight
  const handleSelectFlight = useCallback((f) => {
    setSelected(f);
    const targetPos = latLonToVector3(f.lat, f.lon, GLOBE_RADIUS + 0.05);
    const camTarget = latLonToVector3(f.lat, f.lon, GLOBE_RADIUS + 2.5); // zoom in close

    cameraAnimRef.current = {
      startCameraPos: cameraRef.current.position.clone(),
      startControlsTarget: controlsRef.current.target.clone(),
      targetCameraPos: camTarget,
      targetControlsTarget: targetPos,
      duration: 1.4,
      elapsed: 0
    };

    const route = getDeterministicRoute(f.callsign || f.icao24);
    if (route) {
      draw3DRoute(route.from, route.to);
    }
  }, [getDeterministicRoute, draw3DRoute]);

  // Initialize ThreeJS Scene
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. Setup Scene, Camera, Renderer
    const container = mapRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030308); // space dark
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = GLOBE_RADIUS + 1.0;
    controls.maxDistance = 25.0;
    controlsRef.current = controls;

    // 2. Add Groups
    const flightGroup = new THREE.Group();
    scene.add(flightGroup);
    flightGroupRef.current = flightGroup;

    const routeGroup = new THREE.Group();
    scene.add(routeGroup);
    routeGroupRef.current = routeGroup;

    const airportGroup = new THREE.Group();
    scene.add(airportGroup);
    airportGroupRef.current = airportGroup;

    // 3. Create Holographic Earth Canvas Texture
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 2048;
    mapCanvas.height = 1024;
    const ctx = mapCanvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    // Draw meridian grids
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let lat = -80; lat <= 80; lat += 10) {
      const y = ((90 - lat) / 180) * mapCanvas.height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapCanvas.width, y); ctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 15) {
      const x = ((lon + 180) / 360) * mapCanvas.width;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapCanvas.height); ctx.stroke();
    }

    // Draw Continents
    ctx.fillStyle = 'rgba(67, 56, 202, 0.16)'; // deep translucent indigo
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)'; // neon blue outline
    ctx.lineWidth = 2.0;

    CONTINENTS.forEach(poly => {
      ctx.beginPath();
      poly.forEach(([lon, lat], idx) => {
        const x = ((lon + 180) / 360) * mapCanvas.width;
        const y = ((90 - lat) / 180) * mapCanvas.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    const earthTexture = new THREE.CanvasTexture(mapCanvas);
    const globeGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMat = new THREE.MeshBasicMaterial({
      map: earthTexture,
      transparent: true,
      opacity: 0.95
    });
    const globeMesh = new THREE.Mesh(globeGeom, globeMat);
    scene.add(globeMesh);

    // Glowing atmosphere wireframe shell
    const wireframeGeom = new THREE.SphereGeometry(GLOBE_RADIUS + 0.02, 36, 18);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeom, wireframeMat);
    scene.add(wireframeMesh);

    // Ambient space dust particles
    const starCount = 500;
    const starGeom = new THREE.BufferGeometry();
    const starPosArray = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const rAtm = GLOBE_RADIUS * (1.1 + Math.random() * 0.4);
      starPosArray[i * 3] = rAtm * Math.sin(phi) * Math.cos(theta);
      starPosArray[i * 3 + 1] = rAtm * Math.sin(phi) * Math.sin(theta);
      starPosArray[i * 3 + 2] = rAtm * Math.cos(phi);
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPosArray, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x4f46e5,
      size: 0.03,
      transparent: true,
      opacity: 0.35
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // Plot airports as static nodes
    Object.entries(AIRPORT_COORDS).forEach(([code, coord]) => {
      const airportMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.6 })
      );
      airportMesh.position.copy(latLonToVector3(coord[0], coord[1], GLOBE_RADIUS + 0.01));
      airportGroup.add(airportMesh);
    });

    // 4. Raycaster & Mouse Hover Event listeners
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(flightGroup.children);
      
      if (intersects.length > 0) {
        const flightMesh = intersects[0].object;
        const flight = flightMesh.userData.flight;
        
        // Show tooltip positioned near the cursor
        setTooltip({
          flight,
          x: e.clientX + 15,
          y: e.clientY - 45
        });
        
        if (hoveredMeshRef.current !== flightMesh) {
          if (hoveredMeshRef.current) {
            hoveredMeshRef.current.material.color.setHex(
              hoveredMeshRef.current.userData.flight.icao24 === selected?.icao24 ? 0xf59e0b : 0x6366f1
            );
          }
          hoveredMeshRef.current = flightMesh;
          flightMesh.material.color.setHex(0xf59e0b); // highlight on hover
        }
      } else {
        setTooltip(null);
        if (hoveredMeshRef.current) {
          hoveredMeshRef.current.material.color.setHex(
            hoveredMeshRef.current.userData.flight.icao24 === selected?.icao24 ? 0xf59e0b : 0x6366f1
          );
          hoveredMeshRef.current = null;
        }
      }
    };

    const onClick = (e) => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(flightGroup.children);
      if (intersects.length > 0) {
        const flight = intersects[0].object.userData.flight;
        handleSelectFlight(flight);
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    // 5. Animation Render loop
    let lastTime = 0;
    const animate = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Subtle atmospheric rotation
      globeMesh.rotation.y += 0.005 * dt;
      wireframeMesh.rotation.y += 0.003 * dt;
      stars.rotation.y -= 0.002 * dt;

      // Smooth Camera Animation Glide
      if (cameraAnimRef.current) {
        const anim = cameraAnimRef.current;
        anim.elapsed += dt;
        const t = Math.min(anim.elapsed / anim.duration, 1.0);
        const ease = t * t * (3 - 2 * t); // smoothstep

        if (!anim.startCameraPos) {
          anim.startCameraPos = camera.position.clone();
          anim.startControlsTarget = controls.target.clone();
        }

        camera.position.lerpVectors(anim.startCameraPos, anim.targetCameraPos, ease);
        controls.target.lerpVectors(anim.startControlsTarget, anim.targetControlsTarget, ease);

        if (t >= 1.0) cameraAnimRef.current = null;
      }

      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    // Trigger initial flights fetch
    fetchFlights().then(data => {
      updateFlightMeshes(data, null);
    });

    const pollInterval = setInterval(async () => {
      const updated = await fetchFlights();
      updateFlightMeshes(updated, selected?.icao24 || null);
    }, 20000);

    requestRef.current = requestAnimationFrame(animate);

    // 6. Handle Resizing
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      globeGeom.dispose();
      globeMat.dispose();
      wireframeGeom.dispose();
      wireframeMat.dispose();
      starGeom.dispose();
      starMat.dispose();
      earthTexture.dispose();
    };
  }, [handleSelectFlight, updateFlightMeshes, selected]);

  const handleSearch = e => {
    const q = e.target.value.toUpperCase();
    setSearchQuery(q);
    if (!q) return;
    const match = flights.find(f => f.callsign?.toUpperCase().includes(q) || f.country?.toUpperCase().includes(q));
    if (match) handleSelectFlight(match);
  };

  const countries = [...new Set(flights.map(f => f.country).filter(Boolean))].sort();

  const filtered = flights.filter(f => {
    const matchSearch = !searchQuery || f.callsign?.toUpperCase().includes(searchQuery);
    const matchCountry = !countryFilter || f.country === countryFilter;
    return matchSearch && matchCountry;
  });

  const regions = [
    { key: 'world', label: '🌍 World' },
    { key: 'northAm', label: '🇺🇸 N. America' },
    { key: 'europe', label: '🇪🇺 Europe' },
    { key: 'asia', label: '🌏 Asia' },
    { key: 'mideast', label: '🇦🇪 Mid East' },
    { key: 'oceania', label: '🇦🇺 Oceania' },
    { key: 'southAm', label: '🇧🇷 S. America' },
    { key: 'africa', label: '🌍 Africa' },
  ];

  return (
    <div className="radar-page">
      <aside className="radar-sidebar">
        <div className="radar-sidebar-header">
          <h2>🛰️ Global 3D Radar</h2>
          <div className="radar-status">
            <span className={`fids-dot ${isLive ? 'live' : 'sim'}`}></span>
            <span>{isLive ? 'LIVE' : 'SIM'} — {flightCount.toLocaleString()} shown {totalCount > flightCount ? `of ${totalCount.toLocaleString()}` : ''}</span>
          </div>

          {/* Region Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.6rem 0' }}>
            {regions.map(r => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                style={{
                  padding: '0.25rem 0.55rem', fontSize: '0.7rem', borderRadius: '20px', cursor: 'pointer',
                  border: region === r.key ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: region === r.key ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  color: region === r.key ? '#a78bfa' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >{r.label}</button>
            ))}
          </div>

          {/* Search */}
          <input className="radar-search" type="text" placeholder="🔍 Search callsign..."
            value={searchQuery} onChange={handleSearch} />

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{
              width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.6rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8rem',
            }}
          >
            <option value="">🌐 All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{COUNTRY_FLAGS[c] || '🏳'} {c}</option>
            ))}
          </select>
        </div>

        {selected ? (
          <div className="flight-detail">
            <button className="detail-back" onClick={() => setSelected(null)}>← Back</button>
            <div className="detail-callsign">{selected.callsign || 'Unknown'}</div>
            <div className="detail-country">
              {COUNTRY_FLAGS[selected.country] || '🏳'} {selected.country}
            </div>
            <div className="detail-grid">
              {[
                ['Altitude', `${selected.altitude?.toLocaleString()} ft`],
                ['Speed', `${selected.speed} kts`],
                ['Heading', `${Math.round(selected.heading)}°`],
                ['Lat / Lon', `${selected.lat}, ${selected.lon}`],
                ['Status', selected.on_ground ? '🟡 On Ground' : '🟢 Airborne'],
              ].map(([l, v]) => (
                <div className="detail-item" key={l}>
                  <span className="detail-label">{l}</span>
                  <span className="detail-value">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flight-list">
            <p className="flight-list-hint">
              {searchQuery || countryFilter
                ? `${filtered.length} result(s)`
                : `${filtered.length} airborne aircraft`}
            </p>
            <div className="flight-list-items">
              {filtered.slice(0, 50).map(f => (
                <div key={f.icao24} className="flight-list-item" onClick={() => handleSelectFlight(f)}>
                  <span className="flight-item-callsign">
                    {COUNTRY_FLAGS[f.country] || '✈'} {f.callsign || f.icao24}
                  </span>
                  <span className="flight-item-alt">{f.altitude?.toLocaleString()}ft</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
      <div className="radar-map" ref={mapRef} style={{ position: 'relative' }}>
        {/* Glowing Raycaster Tooltip overlay */}
        {tooltip && (
          <div style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(10, 10, 20, 0.85)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            color: '#fff',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            zIndex: 100,
            backdropFilter: 'blur(3px)',
            transition: 'opacity 0.15s ease'
          }}>
            <div style={{ fontWeight: 'bold', color: '#a78bfa' }}>{tooltip.flight.callsign || tooltip.flight.icao24}</div>
            <div style={{ color: '#94a3b8' }}>Country: {tooltip.flight.country}</div>
            <div style={{ color: '#94a3b8' }}>Alt: {tooltip.flight.altitude?.toLocaleString()} ft</div>
            <div style={{ color: '#94a3b8' }}>Speed: {tooltip.flight.speed} kts</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tuning vector line dimensions

// Interval adjustments for polling safety
