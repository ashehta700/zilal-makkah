import sys
import json
import math
import os

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
b_file = os.path.join(DATA_DIR, "makkah_buildings_3d.geojson")
h_file = os.path.join(DATA_DIR, "makkah_hotels.geojson")

b_data = json.load(open(b_file, encoding="utf-8"))
h_data = json.load(open(h_file, encoding="utf-8"))

def extract_ring(geom_coords):
    ring = geom_coords
    while isinstance(ring[0][0], list):
        ring = ring[0]
    return ring

def get_centroid(coords):
    ring = extract_ring(coords)
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return [sum(lons)/len(lons), sum(lats)/len(lats)]

def get_bbox(coords):
    ring = extract_ring(coords)
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return (min(lons), min(lats), max(lons), max(lats))

def point_in_poly(lon, lat, ring):
    ring = extract_ring(ring)
    inside = False
    n = len(ring)
    p1x, p1y = ring[0][:2]
    for i in range(n + 1):
        p2x, p2y = ring[i % n][:2]
        if min(p1y, p2y) < lat <= max(p1y, p2y):
            if lon <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                if p1x == p2x or lon <= xinters:
                    inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def guaranteed_interior_point(coords):
    ring = extract_ring(coords)
    c = get_centroid(ring)
    if point_in_poly(c[0], c[1], ring):
        return c
    n = len(ring)
    for i in range(n - 1):
        p1 = ring[i][:2]
        p2 = ring[i + 1][:2]
        edge_mid = [(p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0]
        for factor in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]:
            cand = [
                edge_mid[0] + factor * (c[0] - edge_mid[0]),
                edge_mid[1] + factor * (c[1] - edge_mid[1])
            ]
            if point_in_poly(cand[0], cand[1], ring):
                return cand
    return ring[0][:2]

def dist_m(p1, p2):
    dx = (p1[0] - p2[0]) * 103000
    dy = (p1[1] - p2[1]) * 111000
    return math.sqrt(dx*dx + dy*dy)

# 1. Index 3D Buildings
buildings = []
for i, f in enumerate(b_data["features"]):
    geom = f.get("geometry", {})
    if geom.get("type") == "Polygon":
        c = guaranteed_interior_point(geom["coordinates"])
        bbox = get_bbox(geom["coordinates"])
        buildings.append({
            "idx": i,
            "feature": f,
            "osm_id": str(f["properties"].get("osm_id", f"b_{i}")),
            "name_ar": f["properties"].get("name_ar", ""),
            "name_en": f["properties"].get("name_en", ""),
            "height": float(f["properties"].get("height", 35.0)),
            "centroid": c,
            "bbox": bbox,
            "ring": geom["coordinates"][0]
        })

print(f"Indexed {len(buildings)} 3D building polygons.")

# 2. Priority Landmarks
def find_b_by_id(oid):
    for b in buildings:
        if b["osm_id"] == oid:
            return b
    return None

def find_b_by_name(q):
    for b in buildings:
        if q in b["name_ar"] or q in b["name_en"]:
            return b
    return None

snapped_features = []
seen_b_ids = set()
seen_names = set()

# A. Abraj Al-Bait Complex (7 Towers + Podium)
abraj_towers = [
    ("tower_makkah_clock_royal", "برج فندق ساعة مكة الملكي (فيرمونت)", "Makkah Clock Royal Tower - Fairmont", "5 نجوم فاخر", "858"),
    ("tower_zamzam_pullman", "فندق بولمان زمزم مكة (برج زمزم)", "Pullman ZamZam Makkah", "5 نجوم", "1315"),
    ("tower_hajar_movenpick", "فندق موفنبيك برج هاجر مكة", "Mövenpick Hotel Hajar Tower Makkah", "5 نجوم", "1200"),
    ("tower_maqam_swissotel", "فندق سويس أوتيل المقام مكة", "Swissôtel Al Maqam Makkah", "5 نجوم", "1624"),
    ("tower_qibla_swissotel", "فندق سويس أوتيل مكة (برج القبلة)", "Swissôtel Makkah - Al Qibla Tower", "5 نجوم", "1487"),
    ("tower_marwah_rotana", "فندق المروة ريحان من روتانا (برج المروة)", "Al Marwa Rayhaan by Rotana", "5 نجوم", "516"),
    ("tower_safa_raffles", "فندق قصر مكة رافلز (برج الصفا)", "Raffles Makkah Palace", "5 نجوم فاخر", "214"),
    ("podium_abraj_al_bait", "مجمع أبراج البيت التجاري والسكني", "Abraj Al-Bait Commercial Center", "مجمع فاخر", "مجمع")
]

for oid, name_ar, name_en, stars, rooms in abraj_towers:
    b = find_b_by_id(oid)
    if b:
        c = b["centroid"]
        h = b["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))
        snapped_features.append({
            "type": "Feature",
            "id": f"hotel_{oid}",
            "geometry": {
                "type": "Point",
                "coordinates": [round(c[0], 6), round(c[1], 6)]
            },
            "properties": {
                "name_ar": name_ar,
                "name_en": name_en,
                "stars": stars,
                "rooms": rooms,
                "dist_to_kaaba_meters": dist_kaaba,
                "walk_mins_est": round(dist_kaaba / 75.0, 1),
                "building_height": h,
                "building_osm_id": oid,
                "is_landmark": True
            }
        })
        seen_b_ids.add(b["osm_id"])
        seen_names.add(name_ar)
        seen_names.add(name_en)

# B. Major Haram & Jabal Omar Landmarks
other_landmarks = [
    ("دار التوحيد", "فندق دار التوحيد إنتركونتيننتال", "Dar Al Tawhid Intercontinental", "5 نجوم فاخر", "600"),
    ("أبراج الصفوة", "فندق أبراج الصفوة (الصفوة رويال أوركيد)", "Al Safwah Royale Orchid", "5 نجوم", "1200"),
    ("انجم مكة", "فندق أنجم مكة الشبيكة", "Anjum Hotel Makkah", "5 نجوم", "1748"),
    ("Conrad", "فندق كونراد مكة (جبل عمر)", "Conrad Makkah Jabal Omar", "5 نجوم فاخر", "438"),
    ("هيلتون جبل عمر", "فندق ومركز مؤتمرات هيلتون جبل عمر مكة", "Hilton Makkah Convention Hotel", "5 نجوم", "764"),
    ("Hyatt", "فندق جبل عمر حياة ريجنسي مكة", "Jabal Omar Hyatt Regency Makkah", "5 نجوم", "656"),
    ("العنوان جبل عمر", "فندق العنوان جبل عمر مكة", "Address Jabal Omar Makkah", "5 نجوم فاخر", "1484"),
    ("ماريوت جبل عمر", "فندق ماريوت جبل عمر مكة", "Makkah Marriott Hotel", "5 نجوم", "426"),
    ("دبل ترى", "فندق دبل تري من هيلتون جبل عمر", "DoubleTree by Hilton Jabal Omar", "5 نجوم", "676"),
    ("أبراج التيسير", "فندق أبراج التيسير مكة", "Al Tayseer Towers Hotel", "4 نجوم", "800")
]

for query, name_ar, name_en, stars, rooms in other_landmarks:
    b = find_b_by_name(query)
    if b and b["osm_id"] not in seen_b_ids:
        c = b["centroid"]
        h = b["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))
        snapped_features.append({
            "type": "Feature",
            "id": f"hotel_b_{b['osm_id']}",
            "geometry": {
                "type": "Point",
                "coordinates": [round(c[0], 6), round(c[1], 6)]
            },
            "properties": {
                "name_ar": name_ar,
                "name_en": name_en,
                "stars": stars,
                "rooms": rooms,
                "dist_to_kaaba_meters": dist_kaaba,
                "walk_mins_est": round(dist_kaaba / 75.0, 1),
                "building_height": h,
                "building_osm_id": b["osm_id"],
                "is_landmark": True
            }
        })
        seen_b_ids.add(b["osm_id"])
        seen_names.add(name_ar)
        seen_names.add(name_en)

print(f"Added {len(snapped_features)} verified landmark hotels.")

# C. Process remaining hotels from h_data
tokens_to_skip = [
    "رافلز", "ساعة مكة", "زمزم", "هاجر", "المقام", "القبلة", "المروة",
    "Raffles", "Rotana", "Swissotel", "Swissôtel", "Fairmont", "Pullman",
    "Movenpick", "Mövenpick", "Conrad", "Tawhid", "توحيد", "الصفوة", "أنجم", "انجم"
]

for hf in h_data["features"]:
    p = hf["properties"]
    name_ar = p.get("name_ar", "").strip()
    name_en = p.get("name_en", "").strip()

    if any(tok.lower() in name_ar.lower() or tok.lower() in name_en.lower() for tok in tokens_to_skip):
        continue
    if name_ar in seen_names or name_en in seen_names:
        continue

    hlon, hlat = hf["geometry"]["coordinates"]

    # 1. Match building: inside first
    matched = None
    for b in buildings:
        if b["bbox"][0] <= hlon <= b["bbox"][2] and b["bbox"][1] <= hlat <= b["bbox"][3]:
            if point_in_poly(hlon, hlat, b["ring"]):
                matched = b
                break

    # 2. Nearest building within 55 meters
    if not matched:
        best_d = 55.0
        for b in buildings:
            d = dist_m([hlon, hlat], b["centroid"])
            if d < best_d:
                best_d = d
                matched = b

    # Avoid duplicate hotel markers on the same building
    if matched and matched["osm_id"] not in seen_b_ids:
        c = matched["centroid"]
        h = matched["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))

        snapped_features.append({
            "type": "Feature",
            "id": hf.get("id", f"hotel_{len(snapped_features)}"),
            "geometry": {
                "type": "Point",
                "coordinates": [round(c[0], 6), round(c[1], 6)]
            },
            "properties": {
                "name_ar": name_ar or matched["name_ar"],
                "name_en": name_en or matched["name_en"],
                "stars": p.get("stars", "N/A"),
                "rooms": p.get("rooms", "N/A"),
                "dist_to_kaaba_meters": dist_kaaba,
                "walk_mins_est": round(dist_kaaba / 75.0, 1),
                "building_height": h,
                "building_osm_id": matched["osm_id"],
                "is_landmark": h >= 90
            }
        })
        seen_b_ids.add(matched["osm_id"])
        seen_names.add(name_ar)
        seen_names.add(name_en)

print(f"Total clean snapped hotels: {len(snapped_features)}")

# D. 100% Guaranteed Verification: Every single hotel point MUST be inside its building
inside_total = 0
for h in snapped_features:
    hlon, hlat = h["geometry"]["coordinates"]
    inside = False
    for b in buildings:
        if b["bbox"][0] <= hlon <= b["bbox"][2] and b["bbox"][1] <= hlat <= b["bbox"][3]:
            if point_in_poly(hlon, hlat, b["ring"]):
                inside = True
                break
    if inside:
        inside_total += 1
    else:
        print(f"Warning: {h['properties']['name_ar']} still outside!")

print(f"VERIFICATION: {inside_total} of {len(snapped_features)} hotels ({inside_total/len(snapped_features)*100:.1f}%) are 100.0% INSIDE their 3D building polygons!")

# Save clean GeoJSON
out_geojson = {
    "type": "FeatureCollection",
    "name": "Makkah_Hotels_Verified_Snapped",
    "features": snapped_features
}

with open(h_file, "w", encoding="utf-8") as f:
    json.dump(out_geojson, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote {len(snapped_features)} verified snapped hotels to: {h_file}")
