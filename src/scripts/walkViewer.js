/**
 * First-person "step inside" walk mode for property 3D models.
 *
 * Loaded on demand (dynamic import) from PropertyViewer.astro — three.js
 * and this module never load unless the visitor presses the button.
 *
 * Desktop: click to lock pointer, WASD / arrows to walk, Shift to move
 * faster, Esc or ✕ to leave. Mobile: left-thumb joystick to walk, drag
 * anywhere else to look.
 *
 * Movement is "tour style": the camera follows floor height (stairs work)
 * via a throttled downward raycast, with no wall collision so visitors
 * can never get stuck.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// BVH-accelerated raycasts: floor-follow against millions of triangles
// drops from ~100ms to <1ms per cast.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const EYE = 1.6;            // eye height in metres
const WALK_SPEED = 2.6;     // m/s
const RUN_MULT = 2.1;
const FLOOR_SNAP_MS = 90;   // raycast throttle
const MAX_STEP = 2.4;       // ignore floors further than this below the ray start

let active = null;

export async function startWalk(opts) {
  if (active) return;
  const { modelUrl, title = '', subtitle = '' } = opts;

  const overlay = buildOverlay(title, subtitle);
  document.body.appendChild(overlay.root);
  document.documentElement.style.overflow = 'hidden';

  // Basic escape hatch from the moment the overlay exists — replaced by
  // the full dispose() once the scene is running.
  const bail = () => {
    overlay.root.remove();
    document.documentElement.style.overflow = '';
    active = null;
  };
  overlay.exitBtn.addEventListener('click', () => (active?.dispose || bail)());
  document.addEventListener('keydown', function esc(e) {
    if (e.code !== 'Escape') return;
    if (!active || active.disposed) { document.removeEventListener('keydown', esc); return; }
    (active.dispose || bail)();
  });

  const state = {
    overlay,
    disposed: false,
    keys: new Set(),
    yaw: 0,
    pitch: 0,
    joy: { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
    lookTouch: { id: null, lx: 0, ly: 0 },
    lastSnap: 0,
    grounded: false,
    velY: 0,
  };
  active = state;

  const renderer = new THREE.WebGLRenderer({
    canvas: overlay.canvas,
    antialias: window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  state.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8d2c6);
  scene.fog = new THREE.Fog(0xd8d2c6, 120, 420);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
  sun.position.set(60, 90, 30);
  scene.add(sun, new THREE.HemisphereLight(0xfdfbf6, 0x8a8272, 0.75));

  const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
  camera.rotation.order = 'YXZ';
  state.camera = camera;

  const resize = () => {
    const w = overlay.root.clientWidth || window.innerWidth || 1;
    const h = overlay.root.clientHeight || window.innerHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener('resize', resize);
  state.cleanupResize = () => window.removeEventListener('resize', resize);

  // --- load model -------------------------------------------------------
  const draco = new DRACOLoader().setDecoderPath('/js/vendor/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let gltf;
  try {
    gltf = await new Promise((res, rej) =>
      loader.load(modelUrl, res, (ev) => {
        if (ev.total) overlay.setProgress(Math.round((ev.loaded / ev.total) * 100));
      }, rej));
  } catch (err) {
    console.error('[walk] model load failed', err);
    overlay.setStatus('The model could not be loaded — press ✕ to close.');
    state.dispose = bail;
    return;
  }
  if (state.disposed) return;
  draco.dispose();

  const model = gltf.scene;
  overlay.setStatus('Preparing the walkthrough');
  await new Promise((r) => setTimeout(r, 30)); // let the status paint
  model.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position) o.geometry.computeBoundsTree();
  });
  if (state.disposed) return;
  scene.add(model);

  const bbox = new THREE.Box3().setFromObject(model);
  const ray = new THREE.Raycaster();
  ray.far = 500;

  // Spawn inside the main residence: the area-weighted surface centroid
  // sits with the walls and floors of the house — unlike a raw vertex
  // median, it can't be dragged into the garage by vertex-dense props.
  const med = surfaceCentroid(model);
  const spawn = new THREE.Vector3(med.x, bbox.max.y + 2, med.z);
  ray.set(spawn, new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(model, true);
  let floorY = bbox.min.y;
  if (hits.length) {
    floorY = hits[hits.length - 1].point.y;
    // "indoor slab" = a floor with a ceiling 2–6m above it. Of those,
    // spawn on the one nearest the model's vertical midpoint — in a
    // multi-level home that's the main living level, not the garage.
    const slabs = [];
    for (let i = hits.length - 1; i > 0; i--) {
      const gap = hits[i - 1].point.y - hits[i].point.y;
      if (gap > 2 && gap < 6) slabs.push(hits[i].point.y);
    }
    if (slabs.length) {
      const mid = (bbox.min.y + bbox.max.y) / 2;
      floorY = slabs.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
    }
  }
  camera.position.set(spawn.x, floorY + EYE, spawn.z);
  state.yaw = Math.PI / 2 + 0.3;
  window.__walkSpawn = { x: +spawn.x.toFixed(2), z: +spawn.z.toFixed(2), floorY: +floorY.toFixed(2), hits: hits.length };
  console.info('[walk] spawn', JSON.stringify(window.__walkSpawn));

  overlay.hideLoading();

  // --- input ------------------------------------------------------------
  bindInput(state, overlay, renderer);

  // --- loop -------------------------------------------------------------
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  ray.firstHitOnly = true; // spawn needed every hit; floor-follow only needs the first

  function frame() {
    if (state.disposed) return;
    state.raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    camera.rotation.set(state.pitch, state.yaw, 0);

    let mx = 0, mz = 0;
    const k = state.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (state.joy.active) { mx += state.joy.dx; mz -= state.joy.dy; }

    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const speed = WALK_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_MULT : 1);
      fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      right.set(-fwd.z, 0, fwd.x);
      const s = speed * dt / Math.max(1, len);
      camera.position.addScaledVector(fwd, mz * s);
      camera.position.addScaledVector(right, mx * s);
    }

    // floor follow (throttled)
    const now = performance.now();
    if (now - state.lastSnap > FLOOR_SNAP_MS) {
      state.lastSnap = now;
      ray.set(new THREE.Vector3(camera.position.x, camera.position.y + 0.6, camera.position.z), down);
      ray.far = MAX_STEP + EYE + 0.6;
      const h = ray.intersectObject(model, true);
      state.targetY = h.length ? h[0].point.y + EYE : null;
      const rayMs = performance.now() - now;
      const d = (window.__walkStats ||= { rayMax: 0, frames: 0, t0: now });
      if (rayMs > d.rayMax) d.rayMax = rayMs;
      d.rayLast = rayMs;
    }
    if (window.__walkStats) { window.__walkStats.frames++; window.__walkStats.pos = [camera.position.x, camera.position.y, camera.position.z].map(v => +v.toFixed(2)); }
    if (state.targetY != null) {
      camera.position.y += (state.targetY - camera.position.y) * Math.min(1, dt * 10);
    }

    renderer.render(scene, camera);
  }
  frame();

  state.dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    cancelAnimationFrame(state.raf);
    state.cleanupResize();
    state.cleanupInput?.();
    document.exitPointerLock?.();
    renderer.dispose();
    pmrem.dispose();
    scene.traverse((o) => {
      if (o.geometry) { o.geometry.disposeBoundsTree?.(); o.geometry.dispose(); }
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        });
      }
    });
    overlay.root.remove();
    document.documentElement.style.overflow = '';
    active = null;
  };
}

/* ---------------------------------------------------------------------- */

function bindInput(state, overlay, renderer) {
  const canvas = renderer.domElement;
  const isTouch = 'ontouchstart' in window;

  const keydown = (e) => {
    if (e.code === 'Escape') { state.dispose?.(); return; }
    if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { state.keys.add(e.code); e.preventDefault(); }
  };
  const keyup = (e) => state.keys.delete(e.code);
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);

  const mousemove = (e) => {
    if (document.pointerLockElement !== canvas) return;
    state.yaw -= e.movementX * 0.0022;
    state.pitch = clamp(state.pitch - e.movementY * 0.0022, -1.45, 1.45);
  };
  const lockChange = () => {
    overlay.hint.classList.toggle('wv-hidden', document.pointerLockElement === canvas);
  };
  const clickLock = () => { if (!isTouch) canvas.requestPointerLock?.(); };
  document.addEventListener('mousemove', mousemove);
  document.addEventListener('pointerlockchange', lockChange);
  canvas.addEventListener('click', clickLock);

  // touch: left 40% = joystick, rest = look
  const touchstart = (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.4 && state.joy.id == null) {
        state.joy = { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        overlay.showJoystick(t.clientX, t.clientY);
      } else if (state.lookTouch.id == null) {
        state.lookTouch = { id: t.identifier, lx: t.clientX, ly: t.clientY };
      }
    }
    if (e.target === canvas) e.preventDefault();
  };
  const touchmove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === state.joy.id) {
        const dx = (t.clientX - state.joy.ox) / 46;
        const dy = (t.clientY - state.joy.oy) / 46;
        const l = Math.hypot(dx, dy) || 1;
        state.joy.dx = Math.abs(dx) > 1 ? dx / l : dx;
        state.joy.dy = Math.abs(dy) > 1 ? dy / l : dy;
        overlay.moveJoystick(clamp(dx, -1, 1) * 34, clamp(dy, -1, 1) * 34);
      } else if (t.identifier === state.lookTouch.id) {
        state.yaw -= (t.clientX - state.lookTouch.lx) * 0.0042;
        state.pitch = clamp(state.pitch - (t.clientY - state.lookTouch.ly) * 0.0042, -1.45, 1.45);
        state.lookTouch.lx = t.clientX;
        state.lookTouch.ly = t.clientY;
      }
    }
    if (e.target === canvas) e.preventDefault();
  };
  const touchend = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === state.joy.id) { state.joy = { active: false, id: null, dx: 0, dy: 0 }; overlay.hideJoystick(); }
      if (t.identifier === state.lookTouch.id) state.lookTouch = { id: null };
    }
  };
  canvas.addEventListener('touchstart', touchstart, { passive: false });
  canvas.addEventListener('touchmove', touchmove, { passive: false });
  canvas.addEventListener('touchend', touchend);
  canvas.addEventListener('touchcancel', touchend);

  if (isTouch) overlay.hint.textContent = 'Left thumb to walk · drag to look around';

  state.cleanupInput = () => {
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
    document.removeEventListener('mousemove', mousemove);
    document.removeEventListener('pointerlockchange', lockChange);
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function surfaceCentroid(root) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let wx = 0, wz = 0, wsum = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;
    const idx = geo.index;
    const triCount = (idx ? idx.count : pos.count) / 3;
    const step = Math.max(1, Math.floor(triCount / 6000)) * 3;
    const at = (i) => (idx ? idx.getX(i) : i);
    for (let i = 0; i + 2 < (idx ? idx.count : pos.count); i += step) {
      a.fromBufferAttribute(pos, at(i)).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, at(i + 1)).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, at(i + 2)).applyMatrix4(o.matrixWorld);
      ab.subVectors(b, a); ac.subVectors(c, a);
      const area = ab.cross(ac).length();
      if (!area || !isFinite(area)) continue;
      // sqrt damps huge site slabs (roads, lawns) so the house still wins
      const w = Math.sqrt(area);
      wx += w * (a.x + b.x + c.x) / 3;
      wz += w * (a.z + b.z + c.z) / 3;
      wsum += w;
    }
  });
  return wsum ? { x: wx / wsum, z: wz / wsum } : { x: 0, z: 0 };
}

function buildOverlay(title, subtitle) {
  const root = document.createElement('div');
  root.className = 'wv-overlay';
  root.innerHTML = `
    <style>
      .wv-overlay{position:fixed;inset:0;z-index:2000;background:#14110c;touch-action:none}
      .wv-overlay canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
      .wv-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;
        padding:16px 20px;z-index:4;pointer-events:none;
        background:linear-gradient(rgba(20,17,12,.72),transparent)}
      .wv-title{color:#fdfbf6;font-size:11px;font-weight:300;letter-spacing:.3em;text-transform:uppercase}
      .wv-title em{color:#c3a45e;font-style:normal}
      .wv-exit{pointer-events:auto;background:rgba(31,27,20,.7);border:1px solid rgba(195,164,94,.4);color:#fdfbf6;
        width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;
        font-size:15px;line-height:1;backdrop-filter:blur(8px)}
      .wv-exit:hover{border-color:#c3a45e;color:#c3a45e}
      .wv-hint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:4;pointer-events:none;
        padding:10px 20px;background:rgba(31,27,20,.66);border:1px solid rgba(195,164,94,.25);
        color:#c3a45e;font-size:9.5px;font-weight:300;letter-spacing:.28em;text-transform:uppercase;
        backdrop-filter:blur(8px);transition:opacity .5s;white-space:nowrap}
      .wv-hidden{opacity:0}
      .wv-load{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;
        justify-content:center;z-index:3;color:#c3a45e;font-size:10px;letter-spacing:.3em;text-transform:uppercase;
        background:#14110c;transition:opacity .6s}
      .wv-load-bar{width:180px;height:1px;background:rgba(195,164,94,.2);overflow:hidden}
      .wv-load-bar i{display:block;height:100%;width:0;background:#c3a45e;transition:width .3s}
      .wv-joy{position:absolute;width:92px;height:92px;border:1px solid rgba(195,164,94,.4);border-radius:50%;
        z-index:4;pointer-events:none;transform:translate(-50%,-50%);display:none}
      .wv-joy i{position:absolute;left:50%;top:50%;width:34px;height:34px;border-radius:50%;
        background:rgba(195,164,94,.45);transform:translate(-50%,-50%)}
    </style>
    <canvas></canvas>
    <div class="wv-top">
      <div class="wv-title">Inside <em>${escapeHtml(title)}</em>${subtitle ? ' · ' + escapeHtml(subtitle) : ''}</div>
      <button class="wv-exit" type="button" aria-label="Exit walkthrough">✕</button>
    </div>
    <div class="wv-hint">Click to look · WASD to walk · Esc to exit</div>
    <div class="wv-load"><span class="wv-load-txt">Preparing the residence</span><div class="wv-load-bar"><i></i></div></div>
    <div class="wv-joy"><i></i></div>`;

  const canvas = root.querySelector('canvas');
  const load = root.querySelector('.wv-load');
  const loadTxt = root.querySelector('.wv-load-txt');
  const loadBar = root.querySelector('.wv-load-bar i');
  const joy = root.querySelector('.wv-joy');
  const joyDot = joy.querySelector('i');

  return {
    root, canvas,
    exitBtn: root.querySelector('.wv-exit'),
    hint: root.querySelector('.wv-hint'),
    setProgress: (p) => { loadBar.style.width = p + '%'; },
    setStatus: (t) => { loadTxt.textContent = t; },
    hideLoading: () => { load.classList.add('wv-hidden'); setTimeout(() => load.remove(), 700); },
    showJoystick: (x, y) => { joy.style.display = 'block'; joy.style.left = x + 'px'; joy.style.top = y + 'px'; },
    moveJoystick: (x, y) => { joyDot.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`; },
    hideJoystick: () => { joy.style.display = 'none'; joyDot.style.transform = 'translate(-50%,-50%)'; },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
