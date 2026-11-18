const round = (n) => Math.round(n * 1e4) / 1e4;
const stripExt = (s) => String(s || "").replace(/\.[^./\\]+$/, "");
function javaRotation(el) {
  const r = (el.rotation || [0, 0, 0]).map((v) => round(v || 0));
  const axes = [0, 1, 2].filter((k) => r[k]);
  if (!axes.length) return null;
  const origin = (el.origin || [0, 0, 0]).map(round);
  const a = r[axes[0]];
  if (axes.length === 1 && Math.abs(a) <= 45 && a % 22.5 === 0) return { angle: a, axis: "xyz"[axes[0]], origin };
  return { origin, x: r[0], y: r[1], z: r[2] };
}
function toJavaModel(data) {
  const res = data.resolution || { width: 16, height: 16 };
  const texDefs = data.textures || [];
  const texKey = (ref) => {
    if (ref === void 0 || ref === false || ref === null) return null;
    const i = typeof ref === "number" ? ref : texDefs.findIndex((t) => t.uuid === ref);
    return i >= 0 && i < texDefs.length ? i : null;
  };
  const uvSize = (i) => {
    const t = i != null ? texDefs[i] : null;
    return [t?.uv_width || res.width || 16, t?.uv_height || res.height || 16];
  };
  const textures = {};
  texDefs.forEach((t, i) => {
    const name = stripExt(t.name) || `texture_${i}`;
    const folder = t.folder ? `${t.folder}/` : "";
    textures[String(i)] = t.namespace ? `${t.namespace}:${folder}${name}` : `${folder}${name}`;
  });
  const particle = Math.max(0, texDefs.findIndex((t) => t.particle));
  if (texDefs.length) textures.particle = textures[String(particle)];
  const indexOf = new Map();
  const elements = [];
  for (const el of data.elements || []) {
    if ((el.type || "cube") !== "cube" || el.export === false) continue;
    const inf = el.inflate || 0;
    const out = {
      name: el.name || void 0,
      from: el.from.map((v) => round(v - inf)),
      to: el.to.map((v) => round(v + inf))
    };
    const rot = javaRotation(el);
    if (rot) out.rotation = rot;
    if (el.shade === false) out.shade = false;
    const faces = {};
    for (const [dir, f] of Object.entries(el.faces || {})) {
      const ti = texKey(f.texture);
      if (ti === null) continue;
      const [w, h] = uvSize(ti);
      const uv = f.uv || [0, 0, 0, 0];
      const face = {
        uv: [uv[0] * 16 / w, uv[1] * 16 / h, uv[2] * 16 / w, uv[3] * 16 / h].map(round),
        texture: `#${ti}`
      };
      if (f.rotation) face.rotation = f.rotation;
      if (f.cullface) face.cullface = f.cullface;
      if (f.tint !== void 0 && f.tint >= 0) face.tintindex = f.tint;
      faces[dir] = face;
    }
    out.faces = faces;
    indexOf.set(el.uuid, elements.length);
    elements.push(out);
  }
  const groupDefs = new Map((data.groups || []).map((g) => [g.uuid, g]));
  const walk = (node) => {
    if (typeof node === "string") {
      if (indexOf.has(node)) return indexOf.get(node);
      if (!groupDefs.has(node)) return null;
      node = { uuid: node, children: groupDefs.get(node).children || [] };
    }
    const g = { ...groupDefs.get(node.uuid) || {}, ...node };
    const children = (node.children || []).map(walk).filter((c) => c !== null);
    return { name: g.name || "group", origin: (g.origin || [0, 0, 0]).map(round), color: g.color ?? 0, children };
  };
  const groups = (data.outliner || []).map(walk).filter((c) => c !== null);
  const model = { credit: "Made with Blockbench" };
  if (data.parent) model.parent = data.parent;
  if (data.ambientocclusion === false) model.ambientocclusion = false;
  if (data.front_gui_light) model.gui_light = "front";
  if ((res.width || 16) !== 16 || (res.height || 16) !== 16) model.texture_size = [res.width, res.height];
  if (Object.keys(textures).length) model.textures = textures;
  model.elements = elements;
  if (data.display && Object.keys(data.display).length) model.display = data.display;
  if (groups.length) model.groups = groups;
  return model;
}
function javaModelBlob(data) {
  return new Blob([JSON.stringify(toJavaModel(data), null, "	")], { type: "application/json" });
}
async function textureFiles(data) {
  const out = [];
  for (const [i, t] of (data.textures || []).entries()) {
    if (!t.source || !t.source.startsWith("data:image/png")) continue;
    const blob = await (await fetch(t.source)).blob();
    const name = `${stripExt(t.name) || `texture_${i}`}.png`;
    out.push({ name, blob });
  }
  return out;
}
export {
  javaModelBlob,
  textureFiles,
  toJavaModel
};
