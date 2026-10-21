import json
import os
import math

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
b_file = os.path.join(DATA_DIR, "makkah_buildings_3d.geojson")
h_file = os.path.join(DATA_DIR, "makkah_hotels.geojson")

with open(b_file, "r", encoding="utf-8") as f:
    b_data = json.load(f)

with open(h_file, "r", encoding="utf-8") as f:
    h_data = json.load(f)

print(f"Total Buildings: {len(b_data['features'])}")
print(f"Total Hotels: {len(h_data['features'])}")

# Helper to compute polygon centroid and bounding box
def get_polygon_centroid_and_bbox(coords):
    ring = coords[0] if isinstance(coords[0][0], list) else coords
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return (
        sum(lons) / len(lons),
        sum(lats) / len(lats),
        (min(lons), min(lats), max(lons), max(lats))
    )

def point_in_polygon(lon, lat, ring):
    inside = False
    n = len(ring)
    p1x, p1y = ring[0]
    for i in range(n + 1):
        p2x, p2y = ring[i % n]
        if min(p1y, p2y) < lat <= max(p1y, p2y):
            if lon <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                if p1x == p2x or lon <= xinters:
                    inside = not inside
        p1x, p1y = p2x, p2y
    return inside

# Precompute building centroids, bboxes, rings, and heights
buildings = []
for idx, bf in enumerate(b_data["features"]):
    geom = bf.get("geometry", {})
    if geom.get("type") == "Polygon":
        c_lon, c_lat, bbox = get_polygon_centroid_and_bbox(geom["coordinates"])
        buildings.append({
            "idx": idx,
            "feature": bf,
            "name_ar": bf["properties"].get("name_ar", ""),
            "name_en": bf["properties"].get("name_en", ""),
            "height": float(bf["properties"].get("height", 35.0)),
            "centroid": [c_lon, c_lat],
            "bbox": bbox,
            "ring": geom["coordinates"][0]
        })

print(f"Precomputed {len(buildings)} building polygons.")

# Check how many hotels fall inside an existing building polygon
inside_count = 0
outside_count = 0
for hf in h_data["features"]:
    hlon, hlat = hf["geometry"]["coordinates"]
    is_in = False
    for b in buildings:
        min_lon, min_lat, max_lon, max_lat = b["bbox"]
        if min_lon <= hlon <= max_lon and min_lat <= hlat <= max_lat:
            if point_in_polygon(hlon, hlat, b["ring"]):
                is_in = True
                break
    if is_in:
        inside_count += 1
    else:
        outside_count += 1

print(f"Hotels already inside a building polygon: {inside_count} ({inside_count/len(h_data['features'])*100:.1f}%)")
print(f"Hotels OUTSIDE building polygons (sitting in streets/courtyards): {outside_count} ({outside_count/len(h_data['features'])*100:.1f}%)")
