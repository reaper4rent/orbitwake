import * as THREE from "three";

const SAVE_KEY = "orbitwake_v1";
const $ = (id) => document.getElementById(id);

const WORLDS = {
  ember: {
    id: "ember",
    name: "EMBER HOLLOW",
    fog: 0x3a1030,
    sky: 0x2a1248,
    ground: 0xc44a3a,
    ground2: 0x6b2038,
    accent: 0xf0c14a,
    tree: 0xe8d6b0,
    treeTop: 0xffc14d,
    resource: "resin",
  },
  hexcore: {
    id: "hexcore",
    name: "HEXCORE",
    fog: 0x142868,
    sky: 0x102060,
    ground: 0x4a6cff,
    ground2: 0x2a1a68,
    accent: 0x7cf0ff,
    tree: 0x6a8cff,
    treeTop: 0xc8e8ff,
    resource: "ore",
  },
  tide: {
    id: "tide",
    name: "TIDE CROWN",
    fog: 0x1a4a88,
    sky: 0x1c6ad0,
    ground: 0x3aa0ff,
    ground2: 0x1450a0,
    accent: 0xff5a3a,
    tree: 0x2a6a40,
    treeTop: 0xff4a2a,
    resource: "resin",
  },
};

const SKUS = [
  { id: "pack_starter", name: "Starter Cache", desc: "120 crystals", type: "iap", crystals: 120, usd: 0.99 },
  { id: "pack_pioneer", name: "Pioneer Cache", desc: "700 crystals", type: "iap", crystals: 700, usd: 4.99 },
  { id: "pack_founder", name: "Founder Cache", desc: "1600 crystals + trail", type: "iap", crystals: 1600, usd: 9.99, grant: "trail_gold" },
  { id: "suit_aurora", name: "Aurora Suit", desc: "Teal/violet visor", type: "cosmetic", cost: 250 },
  { id: "suit_ember", name: "Ember Suit", desc: "Molten trim", type: "cosmetic", cost: 250 },
  { id: "trail_gold", name: "Solar Wake", desc: "Gold jet trail", type: "cosmetic", cost: 180 },
  { id: "o2_tank", name: "O2 Flush", desc: "Instant oxygen refill", type: "consumable", cost: 40 },
  { id: "boost_gather", name: "Survey Boost", desc: "2x gather for 8 min", type: "consumable", cost: 90 },
];

const defaultSave = () => ({
  resin: 6,
  ore: 2,
  crystals: 80,
  o2: 100,
  power: 100,
  world: "ember",
  owned: [],
  suit: "default",
  trail: "default",
  gatherUntil: 0,
  modules: { habitat: 1, solar: 0, storage: 0, beacon: 0, rover: 0 },
  placed: [],
  missions: { land: true, gather: false, habitat: false, warp: false },
});

let save = load();
function load() {
  try {
    return { ...defaultSave(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
  } catch {
    return defaultSave();
  }
}
function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

const state = {
  tool: "gather",
  keys: {},
  joy: { x: 0, z: 0 },
  placing: null,
  roverOn: false,
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const clock = new THREE.Clock();
let worldGroup = new THREE.Group();
scene.add(worldGroup);

const player = new THREE.Group();
player.position.set(0, 2, 8);
scene.add(player);

const rover = new THREE.Group();
rover.visible = false;
scene.add(rover);

let terrain = null;
let heightFn = () => 0;
const resources = [];
const buildings = [];
let tetherLine = null;
let jet = null;

function noise(x, z) {
  return (
    Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.8 +
    Math.sin(x * 0.27 + 2) * 0.7 +
    Math.cos(z * 0.21) * 0.55
  );
}

function sampleH(x, z) {
  return heightFn(x, z);
}

function makePlayer(suit) {
  while (player.children.length) player.remove(player.children[0]);
  const bodyCol = suit === "suit_ember" ? 0xff6a3a : suit === "suit_aurora" ? 0x4ad8ff : 0xf2f6ff;
  const visorCol = suit === "suit_ember" ? 0xffd36a : suit === "suit_aurora" ? 0xb07cff : 0x1a2a44;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 0.7, 6, 10),
    new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.35 })
  );
  body.castShadow = true;
  body.position.y = 0.75;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: visorCol, emissive: visorCol, emissiveIntensity: 0.35 })
  );
  visor.position.set(0, 1.18, 0.18);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.46, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x9aa8b8 })
  );
  pack.position.set(0, 0.82, -0.28);
  jet = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.35, 8),
    new THREE.MeshStandardMaterial({
      color: save.trail === "trail_gold" ? 0xffd36a : 0x7cf0ff,
      emissive: save.trail === "trail_gold" ? 0xffaa22 : 0x3cf,
      emissiveIntensity: 0.8,
    })
  );
  jet.rotation.x = Math.PI;
  jet.position.set(0, 0.55, -0.42);
  player.add(body, visor, pack, jet);
}

function makeRover() {
  while (rover.children.length) rover.remove(rover.children[0]);
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.45, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.3 })
  );
  hull.castShadow = true;
  const cab = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x223044, emissive: 0x112233 })
  );
  cab.position.set(0.15, 0.42, 0);
  for (const [x, z] of [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]]) {
    const w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x222 })
    );
    w.rotation.z = Math.PI / 2;
    w.position.set(x, -0.12, z);
    rover.add(w);
  }
  const thruster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffaa22, emissiveIntensity: 0.6 })
  );
  thruster.rotation.z = Math.PI / 2;
  thruster.position.set(-1.05, 0.05, 0);
  rover.add(hull, cab, thruster);
}

function hexRing(radius, color) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(1.1, 1.1, 0.18, 6);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * radius, 3 + i * 0.15, Math.sin(a) * radius);
    m.lookAt(0, 3, 0);
    g.add(m);
  }
  return g;
}

function addTree(x, z, w) {
  const y = sampleH(x, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: w.tree })
  );
  trunk.position.set(x, y + 1.2, z);
  trunk.castShadow = true;
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(w.id === "ember" ? 0.2 : 1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: w.treeTop })
  );
  crown.position.set(x, y + (w.id === "ember" ? 3.2 : 2.6), z);
  if (w.id === "ember") {
    crown.geometry = new THREE.ConeGeometry(0.9, 2.4, 5);
    crown.position.y = y + 3.4;
  }
  worldGroup.add(trunk, crown);
}

function addCrystal(x, z, kind) {
  const y = sampleH(x, z);
  const col = kind === "ore" ? 0x7cf0ff : 0xc6ff4a;
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55 })
  );
  mesh.position.set(x, y + 0.55, z);
  mesh.userData = { kind, hp: 1 };
  worldGroup.add(mesh);
  resources.push(mesh);
}

function buildWorld(id) {
  worldGroup.clear();
  resources.length = 0;
  buildings.length = 0;
  const w = WORLDS[id];
  scene.background = new THREE.Color(w.sky);
  scene.fog = new THREE.Fog(w.fog, 28, 140);
  scene.remove(...scene.children.filter((c) => c.isLight));
  scene.add(worldGroup, player, rover);

  const hemi = new THREE.HemisphereLight(0xfff2e0, w.ground2, 0.85);
  const sun = new THREE.DirectionalLight(w.accent, 1.15);
  sun.position.set(30, 40, 12);
  sun.castShadow = true;
  scene.add(hemi, sun);

  heightFn = (x, z) => {
    const base = noise(x, z);
    const crater = Math.max(0, 8 - Math.hypot(x, z) * 0.35);
    if (id === "hexcore") return base * 0.45 + Math.sin(Math.hypot(x, z) * 0.2) * 0.4;
    return base + crater * 0.08;
  };

  const geo = new THREE.PlaneGeometry(180, 180, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightFn(x, z));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: w.ground,
    roughness: 0.92,
    flatShading: true,
  });
  terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  worldGroup.add(terrain);

  const rim = new THREE.Mesh(
    new THREE.CircleGeometry(88, 40),
    new THREE.MeshBasicMaterial({ color: w.ground2, side: THREE.BackSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -2.5;
  worldGroup.add(rim);

  if (id === "hexcore") {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0x1a1038,
        emissive: 0x3a6cff,
        emissiveIntensity: 0.45,
        metalness: 0.4,
      })
    );
    core.position.set(0, 7.5, -18);
    worldGroup.add(core);
    worldGroup.add(hexRing(8, 0x6ad0ff));
    const tunnel = hexRing(5.5, 0x8a7cff);
    tunnel.position.set(0, 4, -18);
    worldGroup.add(tunnel);
  }

  if (id === "ember") {
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe07a })
    );
    sunBall.position.set(-18, 16, -30);
    worldGroup.add(sunBall);
  }

  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 55;
    addTree(Math.cos(a) * r, Math.sin(a) * r, w);
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 48;
    addCrystal(Math.cos(a) * r, Math.sin(a) * r, Math.random() > 0.45 ? w.resource : w.resource === "ore" ? "resin" : "ore");
  }

  save.placed.forEach((p) => {
    if (p.world === id) spawnBuilding(p.kind, p.x, p.z, false);
  });

  if (!save.placed.some((p) => p.world === id && p.kind === "habitat") && save.modules.habitat > 0) {
    spawnBuilding("habitat", 2.2, 4.4, true);
  }

  makeTether();
}

function spawnBuilding(kind, x, z, persistIt) {
  const y = sampleH(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.kind = kind;
  let mesh;
  if (kind === "habitat") {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.25 })
    );
    mesh.position.y = 1.15;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.07, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x7cf0ff, emissive: 0x3cf, emissiveIntensity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.15;
    g.add(mesh, ring);
  } else if (kind === "solar") {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1a3a88, emissive: 0x2244aa, emissiveIntensity: 0.3 })
    );
    mesh.position.y = 1.4;
    mesh.rotation.x = -0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xccc }));
    pole.position.y = 0.7;
    g.add(mesh, pole);
  } else if (kind === "storage") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: 0xb8c4d4 }));
    mesh.position.y = 0.55;
    g.add(mesh);
  } else if (kind === "beacon") {
    mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffaa22, emissiveIntensity: 0.5 })
    );
    mesh.position.y = 1.1;
    g.add(mesh);
  } else if (kind === "rover") {
    makeRover();
    rover.position.set(x, y + 0.4, z);
    rover.visible = true;
    if (persistIt) {
      save.placed.push({ kind, x, z, world: save.world });
      persist();
    }
    buildings.push(rover);
    return rover;
  }
  mesh.castShadow = true;
  worldGroup.add(g);
  buildings.push(g);
  if (persistIt) {
    save.placed.push({ kind, x, z, world: save.world });
    persist();
  }
  return g;
}

function makeTether() {
  if (tetherLine) {
    scene.remove(tetherLine);
    tetherLine = null;
  }
  const hab = buildings.find((b) => b.userData && b.userData.kind === "habitat");
  if (!hab) return;
  const geo = new THREE.BufferGeometry().setFromPoints([player.position.clone(), hab.position.clone()]);
  tetherLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7cf0ff, transparent: true, opacity: 0.55 }));
  scene.add(tetherLine);
}

function nearestResource() {
  let best = null;
  let d = 2.4;
  for (const r of resources) {
    if (!r.visible) continue;
    const dd = r.position.distanceTo(player.position);
    if (dd < d) {
      d = dd;
      best = r;
    }
  }
  return best;
}

function gather() {
  const r = nearestResource();
  if (!r) {
    toast("No deposit in reach");
    return;
  }
  const mult = Date.now() < save.gatherUntil ? 2 : 1;
  save[r.userData.kind] += 1 * mult;
  r.visible = false;
  save.missions.gather = true;
  persist();
  refreshHUD();
  toast(`+${mult} ${r.userData.kind.toUpperCase()}`);
}

function dig() {
  if (!terrain) return;
  const pos = terrain.geometry.attributes.position;
  const px = player.position.x;
  const pz = player.position.z;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x - px, z - pz);
    if (d < 2.4) {
      pos.setY(i, pos.getY(i) - (1 - d / 2.4) * 0.55);
    }
  }
  pos.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  player.position.y = sampleH(px, pz);
  save.resin += Math.random() > 0.6 ? 1 : 0;
  persist();
  refreshHUD();
}

function craft(kind) {
  const cost = {
    habitat: { resin: 12, ore: 0 },
    solar: { resin: 8, ore: 4 },
    storage: { resin: 6, ore: 0 },
    beacon: { resin: 0, ore: 4 },
    rover: { resin: 20, ore: 10 },
  }[kind];
  if (!cost) return;
  if (save.resin < cost.resin || save.ore < cost.ore) {
    toast("Need more materials");
    return;
  }
  save.resin -= cost.resin;
  save.ore -= cost.ore;
  save.modules[kind] = (save.modules[kind] || 0) + 1;
  persist();
  refreshHUD();
  toast(`Printed ${kind.toUpperCase()}`);
}

function buy(sku) {
  if (sku.type === "iap") {
    save.crystals += sku.crystals;
    if (sku.grant && !save.owned.includes(sku.grant)) save.owned.push(sku.grant);
    if (sku.grant === "trail_gold") save.trail = "trail_gold";
    persist();
    makePlayer(save.suit);
    refreshHUD();
    renderShop();
    toast(`Sandbox checkout $${sku.usd.toFixed(2)} — +${sku.crystals} crystals`);
    return;
  }
  if (save.crystals < sku.cost) {
    toast("Not enough crystals");
    return;
  }
  if (sku.type === "cosmetic") {
    if (save.owned.includes(sku.id)) {
      if (sku.id.startsWith("suit")) save.suit = sku.id;
      if (sku.id.startsWith("trail")) save.trail = sku.id;
      makePlayer(save.suit);
      persist();
      toast("Equipped");
      return;
    }
    save.crystals -= sku.cost;
    save.owned.push(sku.id);
    if (sku.id.startsWith("suit")) save.suit = sku.id;
    if (sku.id.startsWith("trail")) save.trail = sku.id;
    makePlayer(save.suit);
    persist();
    renderShop();
    toast("Owned + equipped");
    return;
  }
  if (sku.id === "o2_tank") {
    save.crystals -= sku.cost;
    save.o2 = 100;
    persist();
    refreshHUD();
    toast("O2 flushed");
    return;
  }
  if (sku.id === "boost_gather") {
    save.crystals -= sku.cost;
    save.gatherUntil = Date.now() + 8 * 60 * 1000;
    persist();
    toast("Survey boost live");
  }
}

function refreshHUD() {
  $("resin").textContent = save.resin;
  $("ore").textContent = save.ore;
  $("crystals").textContent = save.crystals;
  $("o2n").textContent = Math.round(save.o2);
  $("pwrn").textContent = Math.round(save.power);
  $("o2b").style.width = `${save.o2}%`;
  $("pwrb").style.width = `${save.power}%`;
  $("worldName").textContent = WORLDS[save.world].name;
}

function renderInv() {
  $("invGrid").innerHTML = ["resin", "ore", "crystals"]
    .map((k) => `<div>${k.toUpperCase()}<br><b>${save[k]}</b></div>`)
    .concat(Object.entries(save.modules).map(([k, v]) => `<div>${k.toUpperCase()}<br><b>${v}</b></div>`))
    .join("");
}

function renderShop() {
  $("shopGrid").innerHTML = SKUS.map((s) => {
    const owned = save.owned.includes(s.id);
    const price = s.type === "iap" ? `$${s.usd.toFixed(2)}` : `${s.cost} cr`;
    const label = s.type === "iap" ? "BUY (SANDBOX)" : owned ? "EQUIP" : "BUY";
    return `<div class="sku"><b>${s.name}</b><span>${s.desc}</span><span class="price">${price}</span><button class="tool" data-sku="${s.id}">${label}</button></div>`;
  }).join("");
}

function renderBuild() {
  $("buildGrid").innerHTML = Object.entries(save.modules)
    .map(([k, v]) => `<div class="sku"><b>${k.toUpperCase()}</b><span>ready ${v}</span><button class="tool" data-place="${k}" ${v < 1 ? "disabled" : ""}>PLACE</button></div>`)
    .join("");
}

function openPanel(id) {
  ["panelInv", "panelShop", "panelBuild"].forEach((p) => $(p).classList.toggle("open", p === id));
  if (id === "panelInv") renderInv();
  if (id === "panelShop") renderShop();
  if (id === "panelBuild") renderBuild();
}

function closePanels() {
  ["panelInv", "panelShop", "panelBuild"].forEach((p) => $(p).classList.remove("open"));
}

function startWorld(id) {
  save.world = id;
  persist();
  $("menu").classList.add("hidden");
  $("ui").style.display = "block";
  makePlayer(save.suit);
  makeRover();
  buildWorld(id);
  player.position.set(0, sampleH(0, 8) + 0.05, 8);
  refreshHUD();
  toast(`Dropped on ${WORLDS[id].name}`);
}

function showMenu() {
  $("menu").classList.remove("hidden");
  $("ui").style.display = "none";
  closePanels();
}

function camFollow(dt) {
  const behind = new THREE.Vector3(0, 5.2, 9.5);
  const target = player.position.clone().add(behind);
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

function habNear() {
  const hab = buildings.find((b) => b.userData && b.userData.kind === "habitat");
  if (!hab) return false;
  return hab.position.distanceTo(player.position) < 14;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  requestAnimationFrame(tick);
  if ($("menu").classList.contains("hidden") === false) {
    renderer.render(scene, camera);
    return;
  }
  const speed = (state.roverOn ? 16 : 8) * (save.power > 0 ? 1 : 0.35);
  let ix = 0;
  let iz = 0;
  if (state.keys["KeyW"] || state.keys["ArrowUp"]) iz -= 1;
  if (state.keys["KeyS"] || state.keys["ArrowDown"]) iz += 1;
  if (state.keys["KeyA"] || state.keys["ArrowLeft"]) ix -= 1;
  if (state.keys["KeyD"] || state.keys["ArrowRight"]) ix += 1;
  ix += state.joy.x;
  iz += state.joy.z;
  const len = Math.hypot(ix, iz) || 1;
  player.position.x += (ix / len) * speed * dt;
  player.position.z += (iz / len) * speed * dt;
  const h = sampleH(player.position.x, player.position.z);
  player.position.y = THREE.MathUtils.lerp(player.position.y, h, 0.25);
  if (ix || iz) player.rotation.y = Math.atan2(ix, iz);
  if (jet) jet.scale.y = 0.6 + Math.hypot(ix, iz) * 0.8;

  if (state.roverOn && rover.visible) {
    rover.position.lerp(player.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.4);
    rover.rotation.y = player.rotation.y;
  }

  const onTether = habNear();
  save.o2 += (onTether ? 12 : -4.2) * dt;
  save.o2 = THREE.MathUtils.clamp(save.o2, 0, 100);
  const hasSolar = buildings.some((b) => b.userData && b.userData.kind === "solar");
  save.power += ((hasSolar ? 6 : -2.2) + (state.roverOn ? -4 : 0)) * dt;
  save.power = THREE.MathUtils.clamp(save.power, 0, 100);
  if (save.o2 <= 0) {
    save.o2 = 35;
    player.position.set(2, sampleH(2, 4), 4);
    toast("O2 failed — recalled to habitat");
  }

  if (tetherLine && buildings.length) {
    const hab = buildings.find((b) => b.userData && b.userData.kind === "habitat");
    if (hab) {
      tetherLine.geometry.setFromPoints([
        player.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        hab.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      ]);
      tetherLine.material.opacity = onTether ? 0.7 : 0.18;
    }
  }

  resources.forEach((r) => {
    r.rotation.y += dt;
    r.position.y = sampleH(r.position.x, r.position.z) + 0.55 + Math.sin(performance.now() / 400 + r.position.x) * 0.08;
  });

  if (state.keys["Space"] && state.tool === "dig") dig();

  refreshHUD();
  camFollow(dt);
  renderer.render(scene, camera);
}

function decorateMenu() {
  const host = $("tris");
  for (let i = 0; i < 50; i++) {
    const s = document.createElement("div");
    s.style.cssText = `position:absolute;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid rgba(180,230,255,${0.15 + Math.random() * 0.4});left:${Math.random() * 100}%;top:${Math.random() * 100}%;transform:rotate(${Math.random() * 360}deg)`;
    host.appendChild(s);
  }
  const car = $("carousel");
  Object.values(WORLDS).forEach((w) => {
    const card = document.createElement("div");
    card.className = "world-card";
    card.innerHTML = `<canvas></canvas><div class="cap">${w.name}</div>`;
    car.appendChild(card);
    paintCard(card.querySelector("canvas"), w);
    card.onclick = () => startWorld(w.id);
  });
}

function paintCard(c, w) {
  const ctx = c.getContext("2d");
  const resize = () => {
    c.width = c.clientWidth * 2;
    c.height = c.clientHeight * 2;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#" + new THREE.Color(w.sky).getHexString());
    g.addColorStop(1, "#" + new THREE.Color(w.ground2).getHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#" + new THREE.Color(w.ground).getHexString();
    ctx.beginPath();
    ctx.moveTo(0, c.height * 0.62);
    ctx.quadraticCurveTo(c.width * 0.4, c.height * 0.4, c.width, c.height * 0.7);
    ctx.lineTo(c.width, c.height);
    ctx.lineTo(0, c.height);
    ctx.fill();
    ctx.fillStyle = "#" + new THREE.Color(w.treeTop).getHexString();
    for (let i = 0; i < 5; i++) {
      const x = c.width * (0.15 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(x, c.height * 0.38);
      ctx.lineTo(x + 28, c.height * 0.7);
      ctx.lineTo(x - 28, c.height * 0.7);
      ctx.fill();
    }
    if (w.id === "hexcore") {
      ctx.strokeStyle = "#8ad8ff";
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(c.width * 0.5, c.height * 0.42, 30 + i * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };
  requestAnimationFrame(resize);
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.addEventListener("keydown", (e) => {
  state.keys[e.code] = true;
  if (e.code === "KeyE") gather();
  if (e.code === "KeyB") openPanel("panelBuild");
  if (e.code === "KeyC") openPanel("panelShop");
  if (e.code === "Escape") {
    if (document.querySelector(".panel.open")) closePanels();
    else showMenu();
  }
});
window.addEventListener("keyup", (e) => {
  state.keys[e.code] = false;
});

document.querySelectorAll(".tool[data-tool]").forEach((b) => {
  b.onclick = () => {
    state.tool = b.dataset.tool;
    document.querySelectorAll(".tool[data-tool]").forEach((x) => x.classList.toggle("on", x === b));
    if (state.tool === "gather") gather();
    if (state.tool === "dig") {
      dig();
      toast("Hold SPACE or tap DIG to excavate");
    }
    if (state.tool === "build") openPanel("panelBuild");
  };
});
$("btnInv").onclick = () => openPanel("panelInv");
$("btnShop").onclick = () => openPanel("panelShop");
$("btnShopMenu").onclick = () => {
  $("menu").classList.add("hidden");
  $("ui").style.display = "block";
  openPanel("panelShop");
};
$("btnWarp").onclick = showMenu;
$("btnContinue").onclick = () => startWorld(save.world || "ember");
$("btnNew").onclick = () => {
  save = defaultSave();
  persist();
  startWorld("ember");
};
$("closeInv").onclick = closePanels;
$("closeShop").onclick = closePanels;
$("closeBuild").onclick = closePanels;

document.addEventListener("click", (e) => {
  const sku = e.target.dataset && e.target.dataset.sku;
  if (sku) buy(SKUS.find((s) => s.id === sku));
  const craftId = e.target.dataset && e.target.dataset.craft;
  if (craftId) craft(craftId);
  const place = e.target.dataset && e.target.dataset.place;
  if (place) {
    if ((save.modules[place] || 0) < 1) return;
    state.placing = place;
    closePanels();
    toast(`Place ${place} — tap terrain`);
  }
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!$("menu").classList.contains("hidden")) return;
  if (!state.placing) return;
  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(terrain)[0];
  if (!hit) return;
  save.modules[state.placing] -= 1;
  spawnBuilding(state.placing, hit.point.x, hit.point.z, true);
  if (state.placing === "habitat") save.missions.habitat = true;
  if (state.placing === "rover") {
    state.roverOn = true;
    toast("Rover linked — move faster");
  }
  makeTether();
  persist();
  toast(`Placed ${state.placing}`);
  state.placing = null;
});

const joy = $("joy");
const knob = $("knob");
function joyAt(ev) {
  const r = joy.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const t = ev.touches ? ev.touches[0] : ev;
  let x = (t.clientX - cx) / (r.width / 2);
  let y = (t.clientY - cy) / (r.height / 2);
  const m = Math.hypot(x, y) || 1;
  if (m > 1) {
    x /= m;
    y /= m;
  }
  state.joy.x = x;
  state.joy.z = y;
  knob.style.left = `${31 + x * 28}px`;
  knob.style.top = `${31 + y * 28}px`;
}
function joyEnd() {
  state.joy.x = 0;
  state.joy.z = 0;
  knob.style.left = "31px";
  knob.style.top = "31px";
}
joy.addEventListener("pointerdown", (e) => {
  joy.setPointerCapture(e.pointerId);
  joyAt(e);
});
joy.addEventListener("pointermove", (e) => {
  if (e.buttons || e.pointerType === "touch") joyAt(e);
});
joy.addEventListener("pointerup", joyEnd);
joy.addEventListener("pointercancel", joyEnd);

makePlayer(save.suit);
makeRover();
decorateMenu();
refreshHUD();
camera.position.set(8, 10, 18);
scene.background = new THREE.Color(0x071226);
tick();
