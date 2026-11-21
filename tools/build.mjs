import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = path.join(ROOT, "site", "models");
const SITE_DIR = path.join(ROOT, "site");
const PAGES_DIR = path.join(SITE_DIR, "m");
const SITE_NAME = "Model List";
const SITE_URL = "https://bb-list.pages.dev";
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const THUMB_RE = /^thumbnail\.(png|jpe?g|webp|gif)$/i;
const HIDDEN = new Set(["info.json", ".ds_store", "thumbs.db", "desktop.ini"]);
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const displayTitle = (t) => String(t).replace(/_/g, " ");
const IMAGE_RECORD = "_images.json";
const VIEW_FILE = "_view.dat";
const VIEW_KEY = Buffer.from("ff45fdd4cc8e655375073b55c00a7099786d89781fc2de6df68053e66389446f", "hex");
const VIEW_GITIGNORE = ["*", "!.gitignore", "!info.json", `!${VIEW_FILE}`, "!_thumb.png", `!${IMAGE_RECORD}`, ""].join("\n");
function writeViewFile(dir, file) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  if (text.startsWith("<lz>")) throw new Error("圧縮された .bbmodel は表示専用に変換できません");
  const d = JSON.parse(text);
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== void 0).map((k) => [k, o[k]]));
  const textures = (d.textures || []).map((t) => {
    let source = t.source;
    if (!source?.startsWith("data:")) {
      const rel = t.relative_path || t.name;
      const p = rel && path.join(dir, rel.replace(/\\/g, "/"));
      source = p && fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString("base64")}` : void 0;
    }
    return pick({ ...t, source }, ["uuid", "uv_width", "uv_height", "render_mode", "force_translucent", "source"]);
  });
  const noName = ({ name, ...o }) => o;
  const outline = (o) => typeof o === "string" ? o : { ...noName(o), children: (o.children || []).map(outline) };
  const data = {
    meta: d.meta && pick(d.meta, ["box_uv"]),
    resolution: d.resolution,
    textures,
    elements: (d.elements || []).map(noName),
    groups: (d.groups || []).map(noName),
    outliner: (d.outliner || []).map(outline)
  };
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 });
  for (let i = 0; i < buf.length; i++) buf[i] ^= VIEW_KEY[i % VIEW_KEY.length] ^ (i * 7 & 255);
  fs.writeFileSync(path.join(dir, VIEW_FILE), buf);
  fs.writeFileSync(path.join(dir, ".gitignore"), VIEW_GITIGNORE);
}
function modelHash(dir) {
  const h = crypto.createHash("sha1");
  if (fs.existsSync(path.join(dir, VIEW_FILE))) return h.update(fs.readFileSync(path.join(dir, VIEW_FILE))).digest("hex").slice(0, 12);
  for (const f of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".bbmodel")).sort()) h.update(f).update(fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n"));
  return h.digest("hex").slice(0, 12);
}
export function writeImageRecord(dir) {
  fs.writeFileSync(path.join(dir, IMAGE_RECORD), JSON.stringify({ model: modelHash(dir) }) + "\n");
}
function readImageRecord(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, IMAGE_RECORD), "utf8")).model || null;
  } catch {
    return null;
  }
}
function writeModelPages(models) {
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  const template = fs.readFileSync(path.join(SITE_DIR, "model.html"), "utf8");
  const abs = (p) => SITE_URL ? `${SITE_URL}/${p}` : p;
  for (const m of models) {
    const title = displayTitle(m.title);
    const desc = m.description || `${title} — Blockbench model`;
    const image = m.thumbnail ? abs(`models/${m.id}/${m.thumbnail}?v=${m.thumbVersion}`) : null;
    const meta = [
      '<base href="../../">',
      `<meta name="model-id" content="${esc(m.id)}">`,
      `<meta name="description" content="${esc(desc)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${SITE_NAME}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      SITE_URL && `<meta property="og:url" content="${esc(abs(`m/${m.id}/`))}">`,
      image && `<meta property="og:image" content="${esc(image)}">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      image && `<meta name="twitter:image" content="${esc(image)}">`
    ].filter(Boolean).map((s) => `  ${s}`).join("\n");
    const html = template.replace('<meta charset="utf-8">', `<meta charset="utf-8">
${meta}`).replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} - ${SITE_NAME}</title>`);
    const dir = path.join(PAGES_DIR, m.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  }
}
function readBBModelName(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    if (text.startsWith("<lz>")) return null;
    return JSON.parse(text).name || null;
  } catch {
    return null;
  }
}
function build({ quiet = false } = {}) {
  const log = quiet ? () => {
  } : console.log;
  const warn = console.warn;
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const models = [];
  for (const dirent of fs.readdirSync(MODELS_DIR, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const id = dirent.name;
    const dir = path.join(MODELS_DIR, id);
    if (!ID_RE.test(id)) {
      warn(`! スキップ: フォルダ名 "${id}" は使えません（半角英小文字・数字・- _ のみ）`);
      continue;
    }
    const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
    const infoPath = path.join(dir, "info.json");
    let info = {};
    if (fs.existsSync(infoPath)) {
      try {
        info = JSON.parse(fs.readFileSync(infoPath, "utf8").replace(/^﻿/, ""));
      } catch (e) {
        warn(`! ${id}/info.json の JSON が壊れています: ${e.message}`);
        continue;
      }
    }
    const viewOnly = info.download === false;
    const bbmodels = files.filter((f) => f.toLowerCase().endsWith(".bbmodel")).sort();
    const source = info.model && files.includes(info.model) ? info.model : bbmodels[0];
    if (viewOnly && source) {
      try {
        writeViewFile(dir, source);
      } catch (e) {
        warn(`! スキップ: ${id} を表示専用に変換できません: ${e.message}`);
        continue;
      }
      if (!files.includes(VIEW_FILE)) files.push(VIEW_FILE);
    } else if (!viewOnly && files.includes(VIEW_FILE)) {
      fs.rmSync(path.join(dir, VIEW_FILE));
      fs.rmSync(path.join(dir, ".gitignore"), { force: true });
      files.splice(files.indexOf(VIEW_FILE), 1);
    }
    const model = viewOnly ? (files.includes(VIEW_FILE) ? VIEW_FILE : null) : source;
    if (!model) {
      warn(`! スキップ: ${id}/ に .bbmodel がありません`);
      continue;
    }
    if (!fs.existsSync(infoPath)) {
      info = {
        title: readBBModelName(path.join(dir, model)) || id,
        description: "",
        tags: [],
        date: today()
      };
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + "\n", "utf8");
      log(`+ ${id}/info.json を作成しました（タイトルや説明を編集できます）`);
    }
    const hash = modelHash(dir);
    const imagesCurrent = readImageRecord(dir) === hash;
    const fresh = (f) => imagesCurrent && files.includes(f);
    const userThumb = files.find((f) => THUMB_RE.test(f)) || null;
    const thumbnail = userThumb || (fresh("_thumb.png") ? "_thumb.png" : null);
    const version = (f) => f ? hash : 0;
    const variants = viewOnly || !Array.isArray(info.variants) ? [] : info.variants.filter((v) => v && v.name && (!v.texture || files.includes(v.texture))).map((v) => ({ name: String(v.name), texture: v.texture || null, ...v.base && v.sub ? { base: String(v.base), sub: String(v.sub) } : {} }));
    const variantFiles = new Set(variants.map((v) => v.texture).filter(Boolean));
    const downloads = viewOnly ? [] : (Array.isArray(info.downloads) ? info.downloads.filter((f) => files.includes(f)) : files.filter((f) => !HIDDEN.has(f.toLowerCase()) && f !== userThumb && !variantFiles.has(f) && !f.startsWith(".") && !f.startsWith("_"))).sort((a, b) => a === model ? -1 : b === model ? 1 : a.localeCompare(b)).map((f) => ({ file: f, size: fs.statSync(path.join(dir, f)).size }));
    models.push({
      id,
      title: String(info.title || id),
      description: String(info.description || ""),
      tags: Array.isArray(info.tags) ? info.tags.map(String) : [],
      date: String(info.date || ""),
      model,
      viewOnly,
      thumbnail,
      thumbVersion: version(thumbnail),
      needsImages: !userThumb && !fresh("_thumb.png"),
      downloads,
      ...variants.length > 1 ? { variants } : {}
    });
  }
  models.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const out = { generated: (new Date()).toISOString(), models };
  fs.writeFileSync(path.join(MODELS_DIR, "index.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  writeModelPages(models);
  log(`✓ ${models.length} 件のモデルを site/models/index.json と site/m/ に書き出しました`);
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build();
}
export {
  MODELS_DIR,
  build
};
