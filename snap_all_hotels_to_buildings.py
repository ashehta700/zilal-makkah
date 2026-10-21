import sys
import json
import math

sys.stdout.reconfigure(encoding='utf-8')

b_file = "data/makkah_buildings_3d.geojson"
h_file = "data/makkah_hotels.geojson"

b_data = json.load(open(b_file, encoding="utf-8"))
h_data = json.load(open(h_file, encoding="utf-8"))

def get_centroid(coords):
    ring = coords[0] if isinstance(coords[0][0], list) else coords
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return [sum(lons)/len(lons), sum(lats)/len(lats)]

def get_bbox(coords):
    ring = coords[0] if isinstance(coords[0][0], list) else coords
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return (min(lons), min(lats), max(lons), max(lats))

def point_in_poly(lon, lat, ring):
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

def dist_m(p1, p2):
    dx = (p1[0] - p2[0]) * 103000
    dy = (p1[1] - p2[1]) * 111000
    return math.sqrt(dx*dx + dy*dy)

# Index all 727 3D buildings
buildings = []
for i, f in enumerate(b_data["features"]):
    geom = f.get("geometry", {})
    if geom.get("type") == "Polygon":
        c = get_centroid(geom["coordinates"])
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

print(f"Loaded {len(buildings)} building polygons.")

# Map specific known landmark buildings by osm_id or unique name
landmark_map = {
    "tower_makkah_clock_royal": {
        "name_ar": "برج فندق ساعة مكة الملكي (فيرمونت)",
        "name_en": "Makkah Clock Royal Tower - Fairmont",
        "stars": "5 نجوم فاخر",
        "rooms": "858"
    },
    "tower_zamzam_pullman": {
        "name_ar": "فندق بولمان زمزم مكة (برج زمزم)",
        "name_en": "Pullman ZamZam Makkah",
        "stars": "5 نجوم",
        "rooms": "1315"
    },
    "tower_hajar_movenpick": {
        "name_ar": "فندق موفنبيك برج هاجر مكة",
        "name_en": "Mövenpick Hotel Hajar Tower Makkah",
        "stars": "5 نجوم",
        "rooms": "1200"
    },
    "tower_maqam_swissotel": {
        "name_ar": "فندق سويس أوتيل المقام مكة",
        "name_en": "Swissôtel Al Maqam Makkah",
        "stars": "5 نجوم",
        "rooms": "1624"
    },
    "tower_qibla_swissotel": {
        "name_ar": "فندق سويس أوتيل مكة (برج القبلة)",
        "name_en": "Swissôtel Makkah - Al Qibla Tower",
        "stars": "5 نجوم",
        "rooms": "1487"
    },
    "tower_marwah_rotana": {
        "name_ar": "فندق المروة ريحان من روتانا (برج المروة)",
        "name_en": "Al Marwa Rayhaan by Rotana",
        "stars": "5 نجوم",
        "rooms": "516"
    },
    "tower_safa_raffles": {
        "name_ar": "فندق قصر مكة رافلز (برج الصفا)",
        "name_en": "Raffles Makkah Palace",
        "stars": "5 نجوم فاخر",
        "rooms": "214"
    }
}

# Find building by osm_id
def find_building_by_osm_id(oid):
    for b in buildings:
        if b["osm_id"] == oid:
            return b
    return None

def find_building_by_name(substring):
    for b in buildings:
        if substring in b["name_ar"] or substring in b["name_en"]:
            return b
    return None

# Build clean, snapped hotels list
snapped_hotels = []
seen_building_ids = set()
seen_names = set()

# 1. Add the 7 Abraj Al-Bait Landmark Towers with 100% exact building geometry
for oid, meta in landmark_map.items():
    b = find_building_by_osm_id(oid)
    if b:
        c = b["centroid"]
        h = b["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))
        snapped_hotels.append({
            "type": "Feature",
            "id": f"hotel_{oid}",
            "geometry": {
                "type": "Point",
                "coordinates": [round(c[0], 6), round(c[1], 6)]
            },
            "properties": {
                "name_ar": meta["name_ar"],
                "name_en": meta["name_en"],
                "stars": meta["stars"],
                "rooms": meta["rooms"],
                "dist_to_kaaba_meters": dist_kaaba,
                "walk_mins_est": round(dist_kaaba / 75.0, 1),
                "building_height": h,
                "building_osm_id": oid,
                "is_landmark": True
            }
        })
        seen_building_ids.add(b["osm_id"])
        seen_names.add(meta["name_ar"])
        seen_names.add(meta["name_en"])

# 2. Add other famous landmark hotels around the Haram
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
    b = find_building_by_name(query)
    if b and b["osm_id"] not in seen_building_ids:
        c = b["centroid"]
        h = b["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))
        snapped_hotels.append({
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
        seen_building_ids.add(b["osm_id"])
        seen_names.add(name_ar)
        seen_names.add(name_en)

print(f"Added {len(snapped_hotels)} primary landmark hotels.")

# 3. Process remaining hotels from h_data
tokens_to_skip = ["رافلز", "ساعة مكة", "زمزم", "هاجر", "المقام", "القبلة", "المروة", "Raffles", "Rotana", "Swissotel", "Fairmont", "Pullman", "Movenpick", "Mövenpick", "Conrad", "Tawhid", "توحيد"]

snapped_existing = 0
for hf in h_data["features"]:
    p = hf["properties"]
    name_ar = p.get("name_ar", "").strip()
    name_en = p.get("name_en", "").strip()

    # Skip duplicates of major landmarks already added
    if any(tok.lower() in name_ar.lower() or tok.lower() in name_en.lower() for tok in tokens_to_skip):
        continue
    if name_ar in seen_names or name_en in seen_names:
        continue

    hlon, hlat = hf["geometry"]["coordinates"]

    # 1. Try to find if it falls inside a building
    matched_building = None
    for b in buildings:
        if b["bbox"][0] <= hlon <= b["bbox"][2] and b["bbox"][1] <= hlat <= b["bbox"][3]:
            if point_in_poly(hlon, hlat, b["ring"]):
                matched_building = b
                break

    # 2. If not inside, find nearest building within 50 meters
    if not matched_building:
        best_d = 50.0
        for b in buildings:
            d = dist_m([hlon, hlat], b["centroid"])
            if d < best_d:
                best_d = d
                matched_building = b

    if matched_building:
        # Snap point 100% to building centroid!
        c = matched_building["centroid"]
        h = matched_building["height"]
        dist_kaaba = round(dist_m(c, [39.82618, 21.42252]))
        
        snapped_hotels.append({
            "type": "Feature",
            "id": hf.get("id", f"hotel_{len(snapped_hotels)}"),
            "geometry": {
                "type": "Point",
                "coordinates": [round(c[0], 6), round(c[1], 6)]
            },
            "properties": {
                "name_ar": name_ar or matched_building["name_ar"],
                "name_en": name_en or matched_building["name_en"],
                "stars": p.get("stars", "N/A"),
                "rooms": p.get("rooms", "N/A"),
                "dist_to_kaaba_meters": dist_kaaba,
                "walk_mins_est": round(dist_kaaba / 75.0, 1),
                "building_height": h,
                "building_osm_id": matched_building["osm_id"],
                "is_landmark": h >= 90
            }
        })
        seen_building_ids.add(matched_building["osm_id"])
        seen_names.add(name_ar)
        seen_names.add(name_en)
        snapped_existing += 1

print(f"Successfully snapped {snapped_existing} additional hotels.")
print(f"Total clean snapped hotels: {len(snapped_hotels)}")

# Verify 100% inside check
all_inside = 0
for h in snapped_hotels:
    hlon, hlat = h["geometry"]["coordinates"]
    inside = False
    for b in buildings:
        if b["bbox"][0] <= hlon <= b["bbox"][2] and b["bbox"][1] <= hlat <= b["bbox"][3]:
            if point_in_poly(hlon, hlat, b["ring"]):
                inside = True
                break
    if inside:
        all_inside += 1

print(f"Final verification: {all_inside} of {len(snapped_hotels)} hotels ({all_inside/len(snapped_hotels)*100:.1f}%) are EXACTLY INSIDE their 3D building polygons!")
