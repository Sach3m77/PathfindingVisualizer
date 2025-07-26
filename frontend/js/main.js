
import { showLoading, hideLoading, showToast, waitForMapUpdate, updateStats } from './utils.js';
import { drawPath, resetAlgorithmVisualization } from './vizualization.js';

maptilersdk.config.apiKey = 'Md1Iez5Hryb0k1ubjF5t';

let startMarker = null;
let endMarker = null;
let obstacleMarker = null;
let startCoords = null;
let endCoords = null;
let obstacleCoords = null;
let toggleLeftButton = null
let sidebar = null;
let toggleBottomButton = null;
let bottomPanel = null;
let graphData = null;
let algorithmRunning = false;
let startNodeId = null;
let endNodeId = null;
let obstacleNodeId = null;
let obstacles = [];
let pathAbortController = null;
let mobileClickStage = 0;
let isMobile = null;

document.addEventListener("DOMContentLoaded", () => {

  fetch("/reset-graph", { method: "POST" });

  isMobile = /Mobi|Android/i.test(navigator.userAgent);

  toggleLeftButton = document.getElementById("toggleSidebar");
  sidebar = document.getElementById("sidebar");

  toggleLeftButton.addEventListener("click", () => {
    sidebar.classList.add("active");
    toggleLeftButton.style.display = "none";
  });

  toggleBottomButton = document.getElementById("toggleBottomPanel");
  bottomPanel = document.getElementById("bottom-panel");

  toggleBottomButton.addEventListener("click", () => {
    bottomPanel.classList.toggle("expanded");
    bottomPanel.classList.toggle("collapsed");
    toggleBottomButton.classList.add("hidden");
  });

  const radiusSlider = document.getElementById("radiusRange");
  const radiusValue = document.getElementById("radiusValue");

  radiusSlider.addEventListener("input", () => {
    radiusValue.textContent = radiusSlider.value;
  })

  const showGraphCheckbox = document.getElementById("showGraph");
  const toast = document.getElementById("toast");

  showGraphCheckbox.parentElement.addEventListener("mouseenter", () => {
    if (showGraphCheckbox.disabled) {
      toast.querySelector(".toast-text").innerText = "Należy najpierw załadować graf.";
      toast.classList.add("show");
    }
  });

  showGraphCheckbox.parentElement.addEventListener("mouseleave", () => {
    toast.classList.remove("show");
  });

  const startButton = document.getElementById("startButton");
  startButton.addEventListener("mouseenter", () => {
    if (showGraphCheckbox.disabled && !algorithmRunning) {
      toast.querySelector(".toast-text").innerText = "Należy najpierw załadować graf.";
      toast.classList.add("show");
    } else if (startButton.disabled && !algorithmRunning) {

      if (!(startMarker || endMarker)) {
        toast.querySelector(".toast-text").innerText = "Należy najpierw zaznaczyć punkt początkowy i końcowy na mapie.";
        toast.classList.add("show");
      } else {
        toast.querySelector(".toast-text").innerText = "Należy najpierw zresetować ścieżkę.";
        toast.classList.add("show");
      }

    } else if (startButton.disabled && algorithmRunning) {
      toast.querySelector(".toast-text").innerText = "Należy poczekać na zakończenie się algorytmu.";
      toast.classList.add("show");
    }
  });

  startButton.addEventListener("mouseleave", () => {
    toast.classList.remove("show");
  });

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    loadGraphButton.disabled = true;
    algorithmRunning = true;
    
    const useAnimation = document.getElementById("showAnimation").checked;
    const selectedAlgo = document.getElementById("algorithm").value;
    const endpoint = selectedAlgo === "dijkstra" ? "/run-dijkstra" : "/run-astar";
    const useObstacles = document.getElementById("useObstacle").checked;

    const payload = {
      start: startNodeId,
      end: endNodeId,
      obstacles: useObstacles ? obstacles.map(o => o.obstacleNodeId) : [],
      animate: useAnimation
    };
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Błąd podczas działania algorytmu.");
      } else {
        if (useAnimation && data.steps) {

          pathAbortController = new AbortController();
          const signal = pathAbortController.signal;


          for (let batch of data.steps) {  
            
            if (signal.aborted) {
              return;
            }
            
            drawPath(batch.map(coords => ({
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: coords
              }
            })));
            await waitForMapUpdate('algorithm-steps');
          }
        }

        drawPath([{
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: data.path
          }
        }], true);

        updateStats({
          time: data.time,
          length: data.length,
          iterations: data.iterations,
          cpu_data: data.cpu,
          ram_data: data.ram
        });
        
      }

    } catch (err) {
      console.error("Błąd:", err);
      showToast("Wystąpił błąd połączenia z backendem.");
    } finally {
      algorithmRunning = false;
      loadGraphButton.disabled = false;
    }
  });

  const loadGraphButton = document.getElementById("loadGraphButton")
  loadGraphButton.addEventListener("mouseenter", () => {
    if (startButton.disabled && algorithmRunning) {
      toast.querySelector(".toast-text").innerText = "Należy poczekać na zakończenie się algorytmu.";
      toast.classList.add("show");
    }
  });

  loadGraphButton.addEventListener("mouseleave", () => {
    toast.classList.remove("show");
  });

  loadGraphButton.addEventListener("click", () => {
    const layers = ["graph-nodes-layer", "graph-edges-layer"];
    const sources = ["graph-nodes", "graph-edges"];

    layers.forEach(layer => {
      if (map.getLayer(layer)) map.removeLayer(layer);
    });
    sources.forEach(source => {
      if (map.getSource(source)) map.removeSource(source);
    });

    if (startMarker) {
      startMarker.remove();
      startMarker = null;
      startCoords = null;
      startNodeId = null;
    }
    
    if (endMarker) {
      endMarker.remove();
      endMarker = null;
      endCoords = null;
      endNodeId = null;
    }
    
    if (obstacles.length > 0) {
      obstacles.forEach(o => o.obstacleMarker.remove());
      obstacles = [];
      obstacleCoords = null;
      obstacleNodeId = null;
    }
    
    startButton.disabled = true;
    clearObstaclesButton.disabled = true;

    resetAlgorithmVisualization();

    const center = map.getCenter();
    const radius = parseInt(document.getElementById("radiusRange").value, 10);
    const coords = { lng: center.lng, lat: center.lat, radius: radius };

    showLoading();
    fetch("/generate-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coords)
    })
      .then(res => res.json())
      .then(data => {
        graphData = data;
        showGraphCheckbox.disabled = false;
        showGraphCheckbox.checked = true;
        showGraphCheckbox.dispatchEvent(new Event("change"));
        showToast("Graf został załadowany i wyświetlony.", 10000);
      })
      .finally(hideLoading);
  });

  const clearObstaclesButton = document.getElementById("clearObstaclesButton");
  clearObstaclesButton.addEventListener("click", () => {
    obstacles.forEach(obs => obs.obstacleMarker.remove());
    obstacles = [];
    clearObstaclesButton.disabled = true;
  });

  const resetButton = document.getElementById("resetButton");
  resetButton.addEventListener("click", () => {
    if (pathAbortController) {
      pathAbortController.abort();
      pathAbortController = null;
    }
    resetAlgorithmVisualization();
    startButton.disabled = false;
  });

  showGraphCheckbox.addEventListener("change", () => {
    if (showGraphCheckbox.checked && graphData) {
      if (!map.getSource("graph-nodes")) {
        map.addSource("graph-nodes", { type: "geojson", data: graphData.nodes });
        map.addLayer({
          id: "graph-nodes-layer",
          type: "circle",
          source: "graph-nodes",
          paint: { "circle-radius": 3, "circle-color": "#00ff00" }
        });
      }

      if (!map.getSource("graph-edges")) {
        map.addSource("graph-edges", { type: "geojson", data: graphData.edges });
        map.addLayer({
          id: "graph-edges-layer",
          type: "line",
          source: "graph-edges",
          paint: { "line-color": "#888", "line-width": 2 }
        });
      }
    } else {
      if (map.getLayer("graph-nodes-layer")) map.removeLayer("graph-nodes-layer");
      if (map.getSource("graph-nodes")) map.removeSource("graph-nodes");
      if (map.getLayer("graph-edges-layer")) map.removeLayer("graph-edges-layer");
      if (map.getSource("graph-edges")) map.removeSource("graph-edges");
    }
  });

});

export const map = new maptilersdk.Map({
  container: 'map',
  style: maptilersdk.MapStyle.BASIC.DARK,
  center: [20.639567, 50.879797],
  zoom: 16
});

map.on('click', (e) => {

  if (e.originalEvent.button !== 0) return;

  if (!graphData && !sidebar.classList.contains("active") && !bottomPanel.classList.contains("expanded")) {
    showToast("Najpierw załaduj graf przyciskiem w panelu.", 2000);
    return;
  }

  if (sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    toggleLeftButton.style.display = "flex";
    if (!bottomPanel.classList.contains("expanded")) return;
  }

  if (bottomPanel.classList.contains("expanded")) {
    bottomPanel.classList.remove("expanded");
    bottomPanel.classList.add("collapsed");
    toggleBottomButton.classList.remove("hidden");
    return;
  }

  const clickedCoords = { lng: e.lngLat.lng, lat: e.lngLat.lat };

  fetch("/nearest-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clickedCoords)
  })
  .then(response => response.json())
  .then(corrected => {
    const coords = [corrected.lng, corrected.lat];
    const nodeId = corrected.node_id;

    if (isMobile) {
      if (mobileClickStage === 0) {
        if (startMarker) startMarker.remove();
        startCoords = coords;
        startNodeId = nodeId;
        startMarker = new maptilersdk.Marker({ color: 'green' }).setLngLat(startCoords).addTo(map);
        showToast("Ustawiono punkt startowy");
      } else if (mobileClickStage === 1) {
        if (endMarker) endMarker.remove();
        endCoords = coords;
        endNodeId = nodeId;
        endMarker = new maptilersdk.Marker({ color: 'red' }).setLngLat(endCoords).addTo(map);
        showToast("Ustawiono punkt końcowy");
      } else if (mobileClickStage === 2) {
        if (!document.getElementById("useObstacle").checked) {
          showToast("Dodawanie przeszkód jest wyłączone.");
          mobileClickStage = (mobileClickStage + 1) % 3;
          startButton.disabled = !(startNodeId && endNodeId);
          return;
        }
        if (obstacles.some(o => o.nodeId === nodeId)) return;
        obstacleCoords = coords;
        obstacleNodeId = nodeId;
        obstacleMarker = new maptilersdk.Marker({ color: "blue" }).setLngLat(obstacleCoords).addTo(map);
        obstacles.push({ obstacleNodeId, obstacleCoords, obstacleMarker });
        document.getElementById("clearObstaclesButton").disabled = false;
        showToast("Dodano przeszkodę");
      }

      mobileClickStage = (mobileClickStage + 1) % 3;
      startButton.disabled = !(startNodeId && endNodeId);

    } else {
      if (startMarker) startMarker.remove();
      startCoords = coords;
      startNodeId = nodeId;
      startMarker = new maptilersdk.Marker({ color: 'green' }).setLngLat(startCoords).addTo(map);
      showToast("Ustawiono punkt startowy");
    }
  });
});

map.on("contextmenu", (e) => {

  if (e.originalEvent.button !== 2) return;

  if (!graphData) {
    showToast("Najpierw załaduj graf przyciskiem w panelu.", 2000);
    return;
  }

  const clickedCoords = { lng: e.lngLat.lng, lat: e.lngLat.lat };

  fetch("/nearest-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clickedCoords)
  })
    .then((response) => response.json())
    .then((corrected) => {
      const coords = [corrected.lng, corrected.lat];
      const nodeId = corrected.node_id;

      if (endMarker) endMarker.remove();
      endCoords = coords;
      endNodeId = nodeId;
      endMarker = new maptilersdk.Marker({ color: "red" }).setLngLat(endCoords).addTo(map);
      showToast("Ustawiono punkt końcowy");
      startButton.disabled = !(startNodeId && endNodeId);
    });
});

map.getCanvas().addEventListener("mousedown", (e) => {
  
  if (e.button !== 1) return;

  if (!graphData) {
    showToast("Najpierw załaduj graf przyciskiem w panelu.", 2000);
    return;
  }

  const rect = map.getCanvas().getBoundingClientRect();
  const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);

  const clickedCoords = { lng: lngLat.lng, lat: lngLat.lat };

  fetch("/nearest-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clickedCoords)
  })
    .then((response) => response.json())
    .then((corrected) => {
      const coords = [corrected.lng, corrected.lat];
      const nodeId = corrected.node_id;

      if (obstacles.some(o => o.nodeId === nodeId)) return;

      obstacleCoords = coords;
      obstacleNodeId = nodeId;

      obstacleMarker = new maptilersdk.Marker({ color: "blue" }).setLngLat(obstacleCoords).addTo(map);
      obstacles.push({ obstacleNodeId, obstacleCoords, obstacleMarker });

      document.getElementById("clearObstaclesButton").disabled = false;
      showToast("Dodano przeszkodę", 20000);
    });

  e.preventDefault();
});
