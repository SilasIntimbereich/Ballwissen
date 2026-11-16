const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "football-arcade-local-stats-v1";
const SETTINGS_KEY = "football-arcade-settings-v1";
function storeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function removeStored(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function readStats() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; return { played: Number.isSafeInteger(value.played) && value.played >= 0 ? value.played : 0, found: Number.isSafeInteger(value.found) && value.found >= 0 ? value.found : 0, best: Number.isFinite(value.best) && value.best >= 0 && value.best <= 100 ? value.best : 0 }; }
  catch { return { played: 0, found: 0, best: 0 }; }
}
function renderStats() {
  const stats = readStats();
  $("#local-played").textContent = stats.played;
  $("#local-found").textContent = stats.found;
  $("#local-best").textContent = stats.best + "%";
  $("#local-stats-note").textContent = stats.played
    ? "Local unranked results on this device. Online ranked results are not included."
    : "No local games recorded yet. Finish a game to start your record.";
}
function loadSettings() {
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
  $("#setting-motion").checked = !!settings.reducedMotion;
  $("#setting-compact").checked = !!settings.compact;
  document.body.classList.toggle("reduce-motion", !!settings.reducedMotion);
  document.body.classList.toggle("compact-ui", !!settings.compact);
}
document.querySelectorAll("[data-open-screen]").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.openScreen === "stats") renderStats();
    if (button.dataset.openScreen === "settings") loadSettings();
    showScreen(button.dataset.openScreen);
  });
});
$("#save-settings")?.addEventListener("click", () => {
  const settings = {
    reducedMotion: $("#setting-motion").checked,
    compact: $("#setting-compact").checked
  };
  const saved = storeJSON(SETTINGS_KEY, settings);
  document.body.classList.toggle("reduce-motion", settings.reducedMotion);
  document.body.classList.toggle("compact-ui", settings.compact);
  $("#settings-feedback").textContent = saved ? "Settings saved on this device." : "Your browser blocked local storage. Settings apply until you close this page.";
});
$("#clear-local-stats")?.addEventListener("click", () => {
  removeStored(STORAGE_KEY);
  renderStats();
});
window.addEventListener("football-arcade:result", event => {
  const { score, total } = event.detail || {};
  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) return;
  const stats = readStats();
  stats.played += 1;
  stats.found += score;
  stats.best = Math.max(stats.best, Math.round(score / total * 100));
  storeJSON(STORAGE_KEY, stats);
});
loadSettings();
