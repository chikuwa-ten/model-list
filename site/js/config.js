const SITE_TITLE = "Model List";
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const PROD_API = "https://model-gallery-api.model-gallery.workers.dev";
const API_BASE = LOCAL ? `http://${location.hostname}:8787` : PROD_API;
export {
  API_BASE,
  SITE_TITLE
};
