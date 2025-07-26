import { map } from './main.js';
import { resetStats } from './utils.js';

let algorithmStepsGeoJSON = {
  type: "FeatureCollection",
  features: []
};

export function drawPath(features, isFinal = false) {
  if (isFinal) {
    const finalGeoJSON = {
      type: "FeatureCollection",
      features
    };

    if (map.getSource('algorithm-final')) {
      map.getSource('algorithm-final').setData(finalGeoJSON);
    } else {
      map.addSource('algorithm-final', {
        type: 'geojson',
        data: finalGeoJSON
      });

      map.addLayer({
        id: 'algorithm-final-line',
        type: 'line',
        source: 'algorithm-final',
        paint: {
          'line-color': '#007cbf',
          'line-width': 5,
          'line-opacity': 1
        }
      });
    }
  } else {
    algorithmStepsGeoJSON.features.push(...features);

    if (map.getSource('algorithm-steps')) {
      map.getSource('algorithm-steps').setData(algorithmStepsGeoJSON);
    } else {
      map.addSource('algorithm-steps', {
        type: 'geojson',
        data: algorithmStepsGeoJSON
      });

      map.addLayer({
        id: 'algorithm-steps-line',
        type: 'line',
        source: 'algorithm-steps',
        paint: {
          'line-color': '#ffa500',
          'line-width': 3,
          'line-opacity': 0.6
        }
      });
    }
  }
}

export function resetAlgorithmVisualization() {

  algorithmStepsGeoJSON = {
    type: "FeatureCollection",
    features: []
  };

  const layers = [
    "algorithm-steps-line",
    "algorithm-final-line"
  ];
  const sources = [
    "algorithm-steps",
    "algorithm-final"
  ];

  layers.forEach(layer => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  sources.forEach(source => {
    if (map.getSource(source)) map.removeSource(source);
  });
  resetStats();
}
