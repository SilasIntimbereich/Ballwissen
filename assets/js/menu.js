const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "football-arcade-local-stats-v1";
const SETTINGS_KEY = "football-arcade-settings-v1";

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function readStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { played: 0, found: 0, best: 0 }; }
  catch { return { played: 0, found: 0, best: 0 }; }
}
function renderStats() {
  const stats = readStats();
  $("#local-played").textContent = stats.played;
  $("#local-found").textContent = stats.found;
  $("#local-best").textContent = stats.best + "%";
  $("#local-stats-note").textContent = stats.played
    ? "Local practice results on this device. Online ranked results are not included."
    : "No local games recorded yet. Finish a practice round to start your record.";
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  document.body.classList.toggle("reduce-motion", settings.reducedMotion);
  document.body.classList.toggle("compact-ui", settings.compact);
  $("#settings-feedback").textContent = "Settings saved on this device.";
});
$("#clear-local-stats")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderStats();
});
const result = $("#result");
if (result) {
  const observer = new MutationObserver(() => {
    const isHidden = result.classList.contains("hidden");
    if (isHidden) { result.dataset.recorded = "0"; return; }
    if (result.dataset.recorded === "1") return;
    result.dataset.recorded = "1";
    if (result.dataset.resultKind !== "practice") return;
    const match = ($("#result-score").textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return;
    const found = Number(match[1]), total = Number(match[2]);
    if (!total) return;
    const stats = readStats();
    stats.played += 1;
    stats.found += found;
    stats.best = Math.max(stats.best, Math.round(found / total * 100));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  });
  observer.observe(result, { attributes: true, attributeFilter: ["class"] });
}
loadSettings();
