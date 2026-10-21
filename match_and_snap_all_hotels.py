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
    # p1: [lon, lat], p2: [lon, lat]
    dx = (p1[0] - p2[0]) * 103000
    dy = (p1[1] - p2[1]) * 111000
    return math.sqrt(dx*dx + dy*dy)

# Prepare buildings index
b_list = []
for i, f in enumerate(b_data["features"]):
    geom = f.get("geometry", {})
    if geom.get("type") == "Polygon":
        c = get_centroid(geom["coordinates"])
        bbox = get_bbox(geom["coordinates"])
        b_list.append({
            "idx": i,
            "feature": f,
            "props": f["properties"],
            "name_ar": f["properties"].get("name_ar", ""),
            "name_en": f["properties"].get("name_en", ""),
            "height": float(f["properties"].get("height", 35.0)),
            "centroid": c,
            "bbox": bbox,
            "ring": geom["coordinates"][0]
        })

print(f"Loaded {len(b_list)} 3D building polygons.")

# Inspect exact matches for major landmark hotels
known_landmarks = {
    "tower_makkah_clock_royal": "برج فندق ساعة مكة الملكي (فيرمونت)",
    "tower_zamzam_pullman": "فندق بولمان زمزم مكة (برج زمزم)",
    "tower_hajar_movenpick": "فندق موفنبيك برج هاجر مكة",
    "tower_maqam_swissotel": "فندق سويس أوتيل المقام مكة",
    "tower_qibla_swissotel": "فندق سويس أوتيل مكة (برج القبلة)",
    "tower_marwah_rotana": "فندق المروة ريحان من روتانا (برج المروة)",
    "tower_safa_raffles": "فندق قصر مكة رافلز (برج الصفا)",
    "podium_abraj_al_bait": "مجمع أبراج البيت التجاري",
    "dar_al_tawhid": "فندق دار التوحيد إنتركونتيننتال",
    "safwah_towers": "فندق أبراج الصفوة (الصفوة رويال أوركيد)",
    "conrad_jabal_omar": "فندق كونراد مكة (جبل عمر)",
    "hilton_convention": "فندق ومركز مؤتمرات هيلتون جبل عمر مكة",
    "hyatt_regency": "فندق جبل عمر حياة ريجنسي مكة",
    "address_jabal_omar": "فندق العنوان جبل عمر مكة",
    "marriott_jabal_omar": "فندق ماريوت جبل عمر",
    "doubletree_hilton": "دبل ترى باي هيلتون جبل عمر مكة",
    "anjum_hotel": "فندق أنجم مكة",
    "al_tayseer_towers": "فندق أبراج التيسير"
}

# Find building centroids for these known landmarks
landmark_coords = {}
for b in b_list:
    name = b["name_ar"]
    h = b["height"]
    osm_id = b["props"].get("osm_id", "")
    
    if "ساعة مكة" in name or osm_id == "tower_makkah_clock_royal":
        landmark_coords["tower_makkah_clock_royal"] = (b["centroid"], h)
    elif "زمزم" in name or osm_id == "tower_zamzam_pullman":
        landmark_coords["tower_zamzam_pullman"] = (b["centroid"], h)
    elif "هاجر" in name or osm_id == "tower_hajar_movenpick":
        landmark_coords["tower_hajar_movenpick"] = (b["centroid"], h)
    elif "المقام" in name or osm_id == "tower_maqam_swissotel":
        landmark_coords["tower_maqam_swissotel"] = (b["centroid"], h)
    elif "القبلة" in name or osm_id == "tower_qibla_swissotel":
        landmark_coords["tower_qibla_swissotel"] = (b["centroid"], h)
    elif "المروة" in name or osm_id == "tower_marwah_rotana":
        landmark_coords["tower_marwah_rotana"] = (b["centroid"], h)
    elif "الصفا" in name and "رافلز" in name or osm_id == "tower_safa_raffles":
        landmark_coords["tower_safa_raffles"] = (b["centroid"], h)
    elif "دار التوحيد" in name:
        landmark_coords["dar_al_tawhid"] = (b["centroid"], h)
    elif "أبراج الصفوة" in name:
        landmark_coords["safwah_towers"] = (b["centroid"], h)
    elif "Conrad" in name and h >= 90:
        landmark_coords["conrad_jabal_omar"] = (b["centroid"], h)
    elif "هيلتون" in name and "مؤتمرات" in name and h >= 100:
        landmark_coords["hilton_convention"] = (b["centroid"], h)
    elif "Hyatt" in name and h >= 90:
        landmark_coords["hyatt_regency"] = (b["centroid"], h)
    elif "العنوان" in name and h >= 140:
        landmark_coords["address_jabal_omar"] = (b["centroid"], h)
    elif "ماريوت" in name and h >= 70:
        landmark_coords["marriott_jabal_omar"] = (b["centroid"], h)
    elif "دبل ترى" in name and h >= 100:
        landmark_coords["doubletree_hilton"] = (b["centroid"], h)
    elif "انجم" in name or "أنجم" in name:
        landmark_coords["anjum_hotel"] = (b["centroid"], h)
    elif "التيسير" in name:
        landmark_coords["al_tayseer_towers"] = (b["centroid"], h)

print("\n--- Verified Landmark Building Centroids ---")
for k, (c, h) in landmark_coords.items():
    print(f"{known_landmarks.get(k, k):45s} | H={h:.0f}m | Centroid=[{c[0]:.6f}, {c[1]:.6f}]")
