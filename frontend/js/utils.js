import { map } from './main.js';

export function showLoading() {
  document.getElementById("loadingOverlay").style.display = "flex";
}

export function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

export function waitForMapUpdate(sourceId) {
  return new Promise(resolve => {
    const onUpdate = (e) => {
      if (e.sourceId === sourceId && e.isSourceLoaded) {
        map.off('sourcedata', onUpdate);
        resolve();
      }
    };
    map.on('sourcedata', onUpdate);
  });
}

export function updateStats({ time = null, length = null, iterations = null, cpu_data = null, ram_data = null }) {
  if (time !== null) document.getElementById("time").textContent = `${time.toFixed(3)}`;
  if (length !== null) document.getElementById("length").textContent = `${length.toFixed(2)}`;
  if (iterations !== null) document.getElementById("iterations").textContent = iterations;
  if (cpu_data != null) {
    document.getElementById("cpu-min").textContent = `${cpu_data.cpu_min.toFixed(1)}%`;
    document.getElementById("cpu-avg").textContent = `${cpu_data.cpu_avg.toFixed(1)}%`;
    document.getElementById("cpu-max").textContent = `${cpu_data.cpu_max.toFixed(1)}%`;
  }
  if (ram_data != null) {
    document.getElementById("ram-min").textContent = `${ram_data.ram_min.toFixed(1)}`;
    document.getElementById("ram-avg").textContent = `${ram_data.ram_avg.toFixed(1)}`;
    document.getElementById("ram-max").textContent = `${ram_data.ram_max.toFixed(1)}`;
  }
}

export function resetStats() {
  document.getElementById("time").textContent = "-";
  document.getElementById("length").textContent = "-";
  document.getElementById("iterations").textContent = "-";

  document.getElementById("cpu-min").textContent = "- %";
  document.getElementById("cpu-avg").textContent = "- %";
  document.getElementById("cpu-max").textContent = "- %";

  document.getElementById("ram-min").textContent = "-";
  document.getElementById("ram-avg").textContent = "-";
  document.getElementById("ram-max").textContent = "-";
}

export function showToast(message, duration = 5000) {
  const toast = document.getElementById("toast");
  toast.querySelector(".toast-text").innerText = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), duration);
}