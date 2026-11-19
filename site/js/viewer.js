import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const VIEW_DIR = new THREE.Vector3(-1, 0.75, -1).normalize();
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(16777215, 9080729, 2));
  const key = new THREE.DirectionalLight(16777215, 1.6);
  key.position.set(-0.6, 1, -0.35);
  scene.add(key);
  const fill = new THREE.DirectionalLight(16777215, 0.6);
  fill.position.set(0.7, 0.3, 0.8);
  scene.add(fill);
}
function fitDistance(object, camera, margin = 1.15) {
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
  const r = Math.max(sphere.radius, 0.5);
  const fov = camera.fov * Math.PI / 180;
  const fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  return r / Math.sin(Math.min(fov, fovH) / 2) * margin;
}
class ModelViewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    addLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5e3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.model = null;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }
  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setModel(object) {
    if (this.model) this.scene.remove(this.model);
    this.model = object;
    this.scene.add(object);
    this.resetView();
  }
  resetView() {
    if (!this.model) return;
    const dist = fitDistance(this.model, this.camera);
    this.camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = dist * 0.15;
    this.controls.maxDistance = dist * 5;
    this.controls.update();
  }
}
let thumb = null;
let queue = Promise.resolve();
function thumbRenderer(width, height) {
  if (!thumb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    addLights(scene);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 5e3);
    thumb = { renderer, scene, camera };
  }
  thumb.renderer.setSize(width, height, false);
  thumb.camera.aspect = width / height;
  return thumb;
}
function renderImage(object, { width, height, background = null, margin = 1.05 }) {
  const job = queue.then(() => {
    const { renderer, scene, camera } = thumbRenderer(width, height);
    renderer.setClearColor(background ?? 0, background == null ? 0 : 1);
    scene.add(object);
    const dist = fitDistance(object, camera, margin);
    camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    camera.near = dist / 100;
    camera.far = dist * 20;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    scene.remove(object);
    return url;
  });
  queue = job.catch(() => {
  });
  return job;
}
function renderThumbnail(object, size = 384) {
  return renderImage(object, { width: size, height: size });
}
export {
  ModelViewer,
  renderImage,
  renderThumbnail
};
