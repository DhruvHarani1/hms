import * as THREE from 'three';

// ─── Mobile Guard ───
// Skip the entire 3D scene on mobile/tablet or when WebGL is unavailable.
// Three.js + WebGL is a heavy GPU workload that kills performance on iPhones.
function isMobileOrNoWebGL() {
  if (window.innerWidth < 1024) return true;
  try {
    const canvas = document.createElement('canvas');
    return !(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return true;
  }
}

export function initThreeScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  // Skip entirely on mobile/tablet — use CSS background instead
  if (isMobileOrNoWebGL()) {
    canvas.style.display = 'none';
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false, // Disable antialias for better performance
    powerPreference: 'low-power', // Request low-power GPU mode
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Cap pixel ratio at 1.5 for performance (was 2)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // ─── Materials ───
  const primaryMat = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    roughness: 0.25,
    metalness: 0.8,
    wireframe: false,
    transparent: true,
    opacity: 0.6,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.3,
    metalness: 0.7,
    transparent: true,
    opacity: 0.5,
  });

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });

  // ─── Geometries — reduced complexity for performance ───
  const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(4.5, 1.2, 96, 24), // reduced from 128,32
    primaryMat,
  );
  torusKnot.position.set(12, 2, -8);
  scene.add(torusKnot);

  const icosahedron = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3, 1),
    accentMat,
  );
  icosahedron.position.set(-14, -3, -5);
  scene.add(icosahedron);

  const octahedron = new THREE.Mesh(
    new THREE.OctahedronGeometry(2, 0),
    accentMat,
  );
  octahedron.position.set(-8, 8, -10);
  scene.add(octahedron);

  const bigSphere = new THREE.Mesh(
    new THREE.SphereGeometry(12, 32, 32), // reduced from 48,48
    wireMat,
  );
  bigSphere.position.set(0, 0, -20);
  scene.add(bigSphere);

  // ─── Small Floating Particles — reduced count ───
  const particleCount = 120; // reduced from 200
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
  }

  particleGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );

  const particleMat = new THREE.PointsMaterial({
    color: 0x818cf8,
    size: 0.06,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ─── Lights ───
  const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x6366f1, 2, 60);
  pointLight1.position.set(10, 10, 10);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x06b6d4, 1.5, 60);
  pointLight2.position.set(-10, -5, 8);
  scene.add(pointLight2);

  // ─── Mouse Tracking (desktop only) ───
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // ─── Resize ───
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // If resized to mobile, stop rendering
      if (window.innerWidth < 1024) {
        canvas.style.display = 'none';
        return;
      }
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 100);
  }, { passive: true });

  // ─── Animate with visibility check ───
  let animationId;
  let isPageVisible = true;

  document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) animate();
    else cancelAnimationFrame(animationId);
  });

  function animate() {
    if (!isPageVisible) return;
    animationId = requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    torusKnot.rotation.x = time * 0.15;
    torusKnot.rotation.y = time * 0.1;
    torusKnot.position.y = 2 + Math.sin(time * 0.5) * 1.5;

    icosahedron.rotation.x = time * 0.2;
    icosahedron.rotation.z = time * 0.15;
    icosahedron.position.y = -3 + Math.cos(time * 0.4) * 1.2;

    octahedron.rotation.y = time * 0.25;
    octahedron.rotation.z = time * 0.1;
    octahedron.position.y = 8 + Math.sin(time * 0.6) * 0.8;

    bigSphere.rotation.y = time * 0.03;
    bigSphere.rotation.x = time * 0.02;

    particles.rotation.y = time * 0.02;

    // Mouse parallax
    camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 1.5 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
}
