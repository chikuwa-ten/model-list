import * as THREE from "three";
const LZUTF8_URL = "https://cdn.jsdelivr.net/npm/lzutf8@0.6.3/build/production/lzutf8.min.js";
const FACES = {
  north: { n: [0, 0, -1], c: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]] },
  south: { n: [0, 0, 1], c: [[0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]] },
  east: { n: [1, 0, 0], c: [[1, 1, 1], [1, 1, 0], [1, 0, 0], [1, 0, 1]] },
  west: { n: [-1, 0, 0], c: [[0, 1, 0], [0, 1, 1], [0, 0, 1], [0, 0, 0]] },
  up: { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  down: { n: [0, -1, 0], c: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] }
};
const DEG = Math.PI / 180;
let lzPromise = null;
function loadLzutf8() {
  if (window.LZUTF8) return Promise.resolve(window.LZUTF8);
  lzPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = LZUTF8_URL;
    s.onload = () => resolve(window.LZUTF8);
    s.onerror = () => reject(new Error("Failed to load lzutf8"));
    document.head.appendChild(s);
  });
  return lzPromise;
}
async function parseBBModelText(text) {
  if (text.startsWith("<lz>")) {
    const LZ = await loadLzutf8();
    text = LZ.decompress(text.slice(4), { inputEncoding: "StorageBinaryString" });
  }
  return JSON.parse(text);
}
const VIEW_KEY = Uint8Array.from("ff45fdd4cc8e655375073b55c00a7099786d89781fc2de6df68053e66389446f".match(/../g), (h) => parseInt(h, 16));
async function decodeView(buf) {
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) b[i] ^= VIEW_KEY[i % VIEW_KEY.length] ^ (i * 7 & 255);
  const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}
async function fetchBBModel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (new URL(url, document.baseURI).pathname.endsWith(".dat")) return decodeView(await res.arrayBuffer());
  return parseBBModelText(await res.text());
}
function setRotation(obj, rot) {
  obj.rotation.order = "ZYX";
  if (rot) obj.rotation.set((rot[0] || 0) * DEG, (rot[1] || 0) * DEG, (rot[2] || 0) * DEG);
}
class GeoBuilder {
  constructor() {
    this.parts = new Map();
  }
  part(key) {
    let p = this.parts.get(key);
    if (!p) this.parts.set(key, p = { pos: [], nor: [], uv: [] });
    return p;
  }
  tri(key, verts, uvs, normal) {
    const p = this.part(key);
    let n = normal;
    if (!n) {
      const a = new THREE.Vector3(...verts[0]), b = new THREE.Vector3(...verts[1]), c = new THREE.Vector3(...verts[2]);
      const v = b.sub(a).cross(c.sub(a)).normalize();
      n = [v.x, v.y, v.z];
    }
    for (let i = 0; i < 3; i++) {
      p.pos.push(...verts[i]);
      p.nor.push(...n);
      p.uv.push(...uvs[i]);
    }
  }
  build(materialFor) {
    const geo = new THREE.BufferGeometry();
    const pos = [], nor = [], uv = [], mats = [];
    for (const [key, p] of this.parts) {
      const start = pos.length / 3;
      pos.push(...p.pos);
      nor.push(...p.nor);
      uv.push(...p.uv);
      geo.addGroup(start, p.pos.length / 3, mats.length);
      mats.push(materialFor(key));
    }
    if (!pos.length) return null;
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return { geo, mats };
  }
}
function boxUV(el, face) {
  const [u, v] = el.uv_offset || [0, 0];
  const w = Math.abs(el.to[0] - el.from[0]);
  const h = Math.abs(el.to[1] - el.from[1]);
  const d = Math.abs(el.to[2] - el.from[2]);
  const m = {
    east: [u, v + d, u + d, v + d + h],
    north: [u + d, v + d, u + d + w, v + d + h],
    west: [u + d + w, v + d, u + 2 * d + w, v + d + h],
    south: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
    up: [u + d + w, v + d, u + d, v],
    down: [u + d + 2 * w, v, u + d + w, v + d]
  }[face];
  if (el.mirror_uv) [m[0], m[2]] = [m[2], m[0]];
  return m;
}
async function buildBBModel(data, baseUrl = document.baseURI) {
  const res = data.resolution || { width: 16, height: 16 };
  const texDefs = data.textures || [];
  const loader = new THREE.TextureLoader();
  const texInfo = await Promise.all(texDefs.map(async (t) => {
    const uvW = t.uv_width || res.width || 16;
    const uvH = t.uv_height || res.height || 16;
    let src = t.source;
    if (!src || !src.startsWith("data:")) {
      const rel = t.relative_path || t.name;
      src = rel ? new URL(rel.replace(/\\/g, "/"), baseUrl).href : null;
    }
    let map = null;
    if (src) {
      try {
        map = await loader.loadAsync(src);
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
        map.flipY = false;
        map.colorSpace = THREE.SRGBColorSpace;
        const img = map.image;
        if (img && img.width && img.height) {
          const frames = Math.round(img.height / img.width / (uvH / uvW));
          if (frames > 1) map.repeat.set(1, 1 / frames);
        }
      } catch (e) {
        console.warn("Failed to load texture:", t.name, e);
        map = null;
      }
    }
    const translucent = t.render_mode === "blend" || t.force_translucent === true;
    return { uuid: t.uuid, uvW, uvH, map, translucent };
  }));
  const texIndex = (ref) => {
    if (ref === void 0 || ref === false) return -1;
    if (ref === null) return null;
    if (typeof ref === "number") return ref < texInfo.length ? ref : -1;
    const i = texInfo.findIndex((t) => t.uuid === ref);
    return i;
  };
  const uvSize = (ti) => ti >= 0 ? texInfo[ti] : { uvW: res.width || 16, uvH: res.height || 16 };
  const matCache = new Map();
  const materialFor = (ti) => {
    if (matCache.has(ti)) return matCache.get(ti);
    let m;
    const t = ti >= 0 ? texInfo[ti] : null;
    if (t && t.map) {
      m = new THREE.MeshLambertMaterial({
        map: t.map,
        side: THREE.DoubleSide,
        alphaTest: t.translucent ? 0.01 : 0.1,
        transparent: t.translucent
      });
    } else {
      m = new THREE.MeshLambertMaterial({ color: 10134445, side: THREE.DoubleSide });
    }
    matCache.set(ti, m);
    return m;
  };
  const elements = new Map((data.elements || []).map((e) => [e.uuid, e]));
  const groups = new Map((data.groups || []).map((g) => [g.uuid, g]));
  const used = new Set();
  function buildCube(el, b) {
    const inf = el.inflate || 0;
    const o = el.origin || [0, 0, 0];
    const from = el.from.map((v, i) => v - inf - o[i]);
    const to = el.to.map((v, i) => v + inf - o[i]);
    const pick = (sel) => sel.map((s, i) => s ? to[i] : from[i]);
    for (const [name, def] of Object.entries(FACES)) {
      const face = el.faces?.[name];
      if (!face) continue;
      const ti = texIndex(face.texture);
      if (ti === null) continue;
      let uv = face.uv;
      if (!uv || el.box_uv && !uv) uv = boxUV(el, name);
      if (!uv) continue;
      const { uvW, uvH } = uvSize(ti);
      const corners = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]].map(([u, v]) => [u / uvW, v / uvH]);
      const k = (face.rotation || 0) / 90 & 3;
      const vuv = [0, 1, 2, 3].map((i) => corners[(i - k + 4) % 4]);
      const p = def.c.map(pick);
      b.tri(ti, [p[0], p[3], p[2]], [vuv[0], vuv[3], vuv[2]], def.n);
      b.tri(ti, [p[0], p[2], p[1]], [vuv[0], vuv[2], vuv[1]], def.n);
    }
  }
  function buildMesh(el, b) {
    const V = el.vertices || {};
    for (const face of Object.values(el.faces || {})) {
      const keys = (face.vertices || []).filter((k) => V[k]);
      if (keys.length < 3) continue;
      const ti = texIndex(face.texture);
      if (ti === null) continue;
      const { uvW, uvH } = uvSize(ti);
      const P = (k) => V[k];
      const U = (k) => {
        const uv = face.uv?.[k] || [0, 0];
        return [uv[0] / uvW, uv[1] / uvH];
      };
      let order = keys;
      if (keys.length === 4) {
        const cand = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3]];
        const ok = (idx) => {
          const [a, bb, c, d] = idx.map((i) => new THREE.Vector3(...P(keys[i])));
          const n1 = bb.clone().sub(a).cross(c.clone().sub(a));
          const n2 = c.clone().sub(a).cross(d.clone().sub(a));
          return n1.dot(n2) > 0;
        };
        const best = cand.find(ok) || cand[0];
        order = best.map((i) => keys[i]);
      }
      for (let i = 1; i < order.length - 1; i++) {
        const tri = [order[0], order[i], order[i + 1]];
        b.tri(ti, tri.map(P), tri.map(U));
      }
    }
  }
  function buildElement(el, parentOrigin) {
    used.add(el.uuid);
    if (el.visibility === false) return null;
    const type = el.type || "cube";
    if (type !== "cube" && type !== "mesh") return null;
    const b = new GeoBuilder();
    if (type === "cube") buildCube(el, b);
    else buildMesh(el, b);
    const built = b.build(materialFor);
    if (!built) return null;
    const mesh = new THREE.Mesh(built.geo, built.mats);
    const o = el.origin || [0, 0, 0];
    mesh.position.set(o[0] - parentOrigin[0], o[1] - parentOrigin[1], o[2] - parentOrigin[2]);
    setRotation(mesh, el.rotation);
    mesh.name = el.name || "";
    return mesh;
  }
  function buildEntry(entry, parentOrigin) {
    if (typeof entry === "string") {
      const el = elements.get(entry);
      return el ? buildElement(el, parentOrigin) : null;
    }
    if (!entry || typeof entry !== "object") return null;
    const g = { ...entry, ...groups.get(entry.uuid) || {} };
    if (g.visibility === false) return null;
    const o = g.origin || [0, 0, 0];
    const obj = new THREE.Group();
    obj.name = g.name || "";
    obj.position.set(o[0] - parentOrigin[0], o[1] - parentOrigin[1], o[2] - parentOrigin[2]);
    setRotation(obj, g.rotation);
    for (const child of entry.children || []) {
      const c = buildEntry(child, o);
      if (c) obj.add(c);
    }
    return obj;
  }
  const root = new THREE.Group();
  for (const entry of data.outliner || []) {
    const c = buildEntry(entry, [0, 0, 0]);
    if (c) root.add(c);
  }
  for (const el of elements.values()) {
    if (!used.has(el.uuid)) {
      const c = buildElement(el, [0, 0, 0]);
      if (c) root.add(c);
    }
  }
  const box = new THREE.Box3().setFromObject(root);
  const wrapper = new THREE.Group();
  wrapper.add(root);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
  }
  wrapper.userData.size = box.isEmpty() ? new THREE.Vector3(16, 16, 16) : box.getSize(new THREE.Vector3());
  wrapper.name = data.name || "";
  return wrapper;
}
async function loadBBModel(url) {
  const data = await fetchBBModel(url);
  return buildBBModel(data, new URL(url, document.baseURI).href);
}
function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
export {
  buildBBModel,
  disposeObject,
  fetchBBModel,
  loadBBModel,
  parseBBModelText
};
