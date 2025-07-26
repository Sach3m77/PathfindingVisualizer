from flask import Flask, request, jsonify, send_from_directory
import osmnx as ox
import json
import time
import psutil
import math

app = Flask(__name__, static_folder="frontend", static_url_path="")
G = None

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/nearest-node", methods=["POST"])
def nearest_node():
    global G
    data = request.get_json()
    lng, lat = data["lng"], data["lat"]

    if G is None:
        return jsonify({"error": "Graf nie został jeszcze załadowany"}), 400

    node_id = ox.distance.nearest_nodes(G, X=lng, Y=lat)
    node = G.nodes[node_id]

    return jsonify({
        "lng": node["x"],
        "lat": node["y"],
        "node_id": node_id
    })

@app.route("/generate-graph", methods=["POST"])
def generate_graph():
    global G
    data = request.get_json()
    lng, lat = data["lng"], data["lat"]
    radius = data.get("radius", 2000)
    center = (lat, lng)

    G = ox.graph_from_point(center, dist=radius, network_type='drive', simplify=False)

    nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)
    nodes_geojson = json.loads(nodes_gdf.reset_index().to_json())
    edges_geojson = json.loads(edges_gdf.reset_index().to_json())

    return jsonify({
        "nodes": nodes_geojson,
        "edges": edges_geojson
    })

@app.route("/reset-graph", methods=["POST"])
def reset_graph():
    global G
    G = None
    return jsonify({"message": "Graf został zresetowany."})

def haversine_distance(x1, y1, x2, y2):
    R = 6371000
    phi1, phi2 = math.radians(y1), math.radians(y2)
    dphi = math.radians(y2 - y1)
    dlambda = math.radians(x2 - x1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def heuristic(n1, n2):
  x1, y1 = G.nodes[n1]["x"], G.nodes[n1]["y"]
  x2, y2 = G.nodes[n2]["x"], G.nodes[n2]["y"]
  return haversine_distance(x1, y1, x2, y2)

def measure_performance(func):
    import threading

    def wrapper(*args, **kwargs):
        process = psutil.Process()
        cpu_samples = []
        mem_samples = []
        stop_event = threading.Event()

        def monitor():
            while not stop_event.is_set():
                cpu_samples.append(process.cpu_percent(interval=0.01))
                mem_samples.append(process.memory_info().rss / (1024 ** 2))

        monitor_thread = threading.Thread(target=monitor)
        monitor_thread.start()

        start_time = time.time()
        try:
            result = func(*args, **kwargs)
        except Exception as e:
            result = {"error": str(e)}
        duration = (time.time() - start_time) * 1000
        
        stop_event.set()
        monitor_thread.join()

        if cpu_samples and mem_samples:
            cpu_stats = {
                "cpu_min": min(cpu_samples),
                "cpu_max": max(cpu_samples),
                "cpu_avg": sum(cpu_samples) / len(cpu_samples)
            }
            mem_stats = {
                "ram_min": min(mem_samples),
                "ram_max": max(mem_samples),
                "ram_avg": sum(mem_samples) / len(mem_samples)
            }
        else:
            cpu_stats = {"cpu_min": 0, "cpu_max": 0, "cpu_avg": 0}
            mem_stats = {"ram_min": 0, "ram_max": 0, "ram_avg": 0}

        return result, duration, cpu_stats, mem_stats

    return wrapper

@app.route("/run-dijkstra", methods=["POST"])
def run_dijkstra():
    global G
    if G is None:
        return jsonify({"error": "Graf nie został jeszcze załadowany"}), 400

    data = request.get_json()
    start = data["start"]
    end = data["end"]
    obstacles = set(data.get("obstacles", []))
    animate = data.get("animate", False)

    if start in obstacles or end in obstacles:
        return jsonify({"error": "Punkt startowy lub końcowy jest przeszkodą."}), 400

    @measure_performance
    def execute():
        dist = {node: float("inf") for node in G.nodes if node not in obstacles}
        prev = {}
        dist[start] = 0
        visited = set()
        queue = [(0, start)]

        steps = []
        feature_batch = []

        while queue:
            queue.sort()
            current_dist, current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            if current == end:
                break

            for _, neighbor, data_edge in G.edges(current, data=True):
                if neighbor in visited or neighbor in obstacles:
                    continue
                new_dist = dist[current] + data_edge.get("length", 1)
                if new_dist < dist.get(neighbor, float("inf")):
                    dist[neighbor] = new_dist
                    prev[neighbor] = current
                    queue.append((new_dist, neighbor))

                    if animate:
                        x1, y1 = G.nodes[current]['x'], G.nodes[current]['y']
                        x2, y2 = G.nodes[neighbor]['x'], G.nodes[neighbor]['y']
                        feature_batch.append([[x1, y1], [x2, y2]])
                        if len(feature_batch) == 50:
                            steps.append(feature_batch)
                            feature_batch = []

        if animate and feature_batch:
            steps.append(feature_batch)

        if end not in prev:
            return {"error": "Algorytm nie jest w stanie odnaleźć ścieżki do celu."}

        path = []
        node = end
        while node is not None:
            path.append([G.nodes[node]['x'], G.nodes[node]['y']])
            node = prev.get(node)

        path.reverse()

        return {
            "result": {
                "path": path,
                "length": dist[end],
                "iterations": len(visited),
                "steps": steps if animate else None
            }
        }

    data, duration, cpu_stats, mem_stats = execute()

    if data.get("error"):
        return jsonify({"error": data["error"]}), 404

    result = data["result"]
    response = {
        "path": result["path"],
        "length": result["length"],
        "time": duration,
        "iterations": result["iterations"],
        "cpu": cpu_stats,
        "ram": mem_stats
    }

    if result.get("steps"):
        response["steps"] = result["steps"]

    return jsonify(response)

@app.route("/run-astar", methods=["POST"])
def run_astar():
    global G
    if G is None:
        return jsonify({"error": "Graf nie został jeszcze załadowany"}), 400

    data = request.get_json()
    start = data["start"]
    end = data["end"]
    obstacles = set(data.get("obstacles", []))
    animate = data.get("animate", False)

    if start in obstacles or end in obstacles:
        return jsonify({"error": "Punkt startowy lub końcowy jest przeszkodą."}), 400

    @measure_performance
    def execute():
        g_score = {node: float("inf") for node in G.nodes if node not in obstacles}
        f_score = {node: float("inf") for node in G.nodes if node not in obstacles}
        came_from = {}
        g_score[start] = 0
        f_score[start] = heuristic(start, end)
        open_set = [(f_score[start], start)]
        visited = set()

        steps = []
        feature_batch = []

        while open_set:
            open_set.sort()
            _, current = open_set.pop(0)
            if current == end:
                break
            visited.add(current)

            for _, neighbor, data_edge in G.edges(current, data=True):
                if neighbor in obstacles or neighbor in visited:
                    continue
                tentative_g = g_score[current] + data_edge.get("length", 1)
                if tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score[neighbor] = tentative_g + heuristic(neighbor, end)
                    open_set.append((f_score[neighbor], neighbor))

                    if animate:
                        x1, y1 = G.nodes[current]['x'], G.nodes[current]['y']
                        x2, y2 = G.nodes[neighbor]['x'], G.nodes[neighbor]['y']
                        feature_batch.append([[x1, y1], [x2, y2]])
                        if len(feature_batch) == 50:
                            steps.append(feature_batch)
                            feature_batch = []

        if animate and feature_batch:
            steps.append(feature_batch)

        if end not in came_from:
            return {"error": "Algorytm nie jest w stanie odnaleźć ścieżki do celu."}

        path = []
        node = end
        while node is not None:
            path.append([G.nodes[node]['x'], G.nodes[node]['y']])
            node = came_from.get(node)

        path.reverse()

        return {
            "result": {
                "path": path,
                "length": g_score[end],
                "iterations": len(visited),
                "steps": steps if animate else None
            }
        }

    data, duration, cpu_stats, mem_stats = execute()

    if data.get("error"):
        return jsonify({"error": data["error"]}), 404

    result = data["result"]
    response = {
        "path": result["path"],
        "length": result["length"],
        "time": duration,
        "iterations": result["iterations"],
        "cpu": cpu_stats,
        "ram": mem_stats
    }

    if result.get("steps"):
        response["steps"] = result["steps"]

    return jsonify(response)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)