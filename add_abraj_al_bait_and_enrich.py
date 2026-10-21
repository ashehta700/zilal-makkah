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

print(f"Loaded {len(b_data['features'])} existing buildings and {len(h_data['features'])} verified hotels.")

# 1. Define Authentic Abraj Al-Bait Complex Towers (The Clock Tower 601m & Surrounding Towers)
# Coordinates centered around real GPS location: [39.8254, 21.4181] directly facing Bab King Abdulaziz

def make_box(center_lon, center_lat, width_m, height_m):
    # Convert meters to degrees approx at latitude 21.4
    d_lon = (width_m / 2.0) / 103000.0
    d_lat = (height_m / 2.0) / 111000.0
    return [
        [center_lon - d_lon, center_lat - d_lat],
        [center_lon + d_lon, center_lat - d_lat],
        [center_lon + d_lon, center_lat + d_lat],
        [center_lon - d_lon, center_lat + d_lat],
        [center_lon - d_lon, center_lat - d_lat]
    ]

def make_octagon(center_lon, center_lat, radius_m):
    pts = []
    d_lon_r = radius_m / 103000.0
    d_lat_r = radius_m / 111000.0
    for i in range(8):
        angle = math.pi / 8 + i * (2 * math.pi / 8)
        pts.append([
            center_lon + d_lon_r * math.cos(angle),
            center_lat + d_lat_r * math.sin(angle)
        ])
    pts.append(pts[0])
    return pts

abraj_towers = [
    {
        "id": "tower_makkah_clock_royal",
        "name_ar": "برج فندق ساعة مكة الملكي (فيرمونت)",
        "name_en": "Makkah Clock Royal Tower - Fairmont",
        "height": 601.0,
        "levels": 120,
        "type": "hotel_landmark",
        "stars": "5 نجوم فاخر",
        "dist_to_kaaba": 490,
        "coords": make_octagon(39.82535, 21.41805, 36.0) # 72m wide octagonal base
    },
    {
        "id": "tower_zamzam_pullman",
        "name_ar": "برج زمزم (فندق بولمان زمزم مكة)",
        "name_en": "Zamzam Tower - Pullman ZamZam Makkah",
        "height": 279.0,
        "levels": 54,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 440,
        "coords": make_box(39.82485, 21.41835, 42.0, 38.0)
    },
    {
        "id": "tower_hajar_movenpick",
        "name_ar": "برج هاجر (فندق موفنبيك هاجر مكة)",
        "name_en": "Hajar Tower - Mövenpick Hotel Makkah",
        "height": 279.0,
        "levels": 54,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 495,
        "coords": make_box(39.82460, 21.41775, 42.0, 38.0)
    },
    {
        "id": "tower_maqam_swissotel",
        "name_ar": "برج المقام (فندق سويس أوتيل المقام مكة)",
        "name_en": "Al Maqam Tower - Swissôtel Al Maqam Makkah",
        "height": 250.0,
        "levels": 48,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 470,
        "coords": make_box(39.82585, 21.41820, 38.0, 36.0)
    },
    {
        "id": "tower_qibla_swissotel",
        "name_ar": "برج القبلة (فندق سويس أوتيل مكة)",
        "name_en": "Al Qibla Tower - Swissôtel Makkah",
        "height": 250.0,
        "levels": 48,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 520,
        "coords": make_box(39.82585, 21.41760, 38.0, 36.0)
    },
    {
        "id": "tower_marwah_rotana",
        "name_ar": "برج المروة (فندق المروة ريحان من روتانا)",
        "name_en": "Al Marwah Tower - Al Marwa Rayhaan by Rotana",
        "height": 250.0,
        "levels": 45,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 420,
        "coords": make_box(39.82635, 21.41845, 36.0, 34.0)
    },
    {
        "id": "tower_safa_raffles",
        "name_ar": "برج الصفا (فندق قصر مكة رافلز)",
        "name_en": "As Safa Tower - Raffles Makkah Palace",
        "height": 250.0,
        "levels": 45,
        "type": "hotel",
        "stars": "5 نجوم",
        "dist_to_kaaba": 380,
        "coords": make_box(39.82560, 21.41870, 36.0, 34.0)
    },
    {
        "id": "podium_abraj_al_bait",
        "name_ar": "مجمع وقف الملك عبد العزيز (أبراج البيت)",
        "name_en": "King Abdulaziz Endowment Podium & Shopping Center",
        "height": 48.0,
        "levels": 12,
        "type": "podium",
        "stars": "مجمع مركزي",
        "dist_to_kaaba": 450,
        "coords": make_box(39.82545, 21.41805, 170.0, 140.0) # Podium base
    }
]

# Convert abraj_towers into GeoJSON features
new_features = []
for t in abraj_towers:
    new_features.append({
        "type": "Feature",
        "id": t["id"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [t["coords"]]
        },
        "properties": {
            "osm_id": t["id"],
            "name_ar": t["name_ar"],
            "name_en": t["name_en"],
            "height": t["height"],
            "levels": t["levels"],
            "building_type": t["type"],
            "stars": t.get("stars", "5 نجوم"),
            "dist_to_kaaba_meters": t.get("dist_to_kaaba", 450),
            "is_landmark": True
        }
    })

print(f"Created {len(new_features)} Abraj Al-Bait tower features.")

# 2. Enrich existing buildings with real hotel names from makkah_hotels.geojson
# Match unnamed buildings to nearest hotel within 50 meters
hotels_list = h_data["features"]
used_hotels = set()

for f in b_data["features"]:
    p = f["properties"]
    poly = f["geometry"]["coordinates"][0]
    # calculate centroid
    c_lon = sum(pt[0] for pt in poly[:-1]) / (len(poly) - 1)
    c_lat = sum(pt[1] for pt in poly[:-1]) / (len(poly) - 1)
    
    # Check if building is already named meaningfully
    name_ar = p.get("name_ar") or ""
    is_unnamed = (not name_ar) or name_ar in ["مبنى غير مسمى", "Unnamed Building", "yes", "None"]
    
    # Check distance to Kaaba
    dx_k = (c_lon - 39.8262) * 103000.0
    dy_k = (c_lat - 21.4225) * 111000.0
    dist_kaaba = round(math.sqrt(dx_k*dx_k + dy_k*dy_k))
    p["dist_to_kaaba_meters"] = dist_kaaba
    
    if is_unnamed:
        # Find closest hotel
        closest_h = None
        min_d = Infinity = 999999
        for h_idx, h in enumerate(hotels_list):
            h_coords = h["geometry"]["coordinates"]
            dx = (c_lon - h_coords[0]) * 103000.0
            dy = (c_lat - h_coords[1]) * 111000.0
            d = math.sqrt(dx*dx + dy*dy)
            if d < min_d:
                min_d = d
                closest_h = (h_idx, h)
                
        # If hotel is within 55m, assign its name!
        if closest_h and min_d <= 55.0:
            h_idx, h = closest_h
            hp = h["properties"]
            p["name_ar"] = hp.get("name_ar", "فندق معتمد")
            p["name_en"] = hp.get("name_en", "Approved Hotel")
            p["stars"] = hp.get("stars", "فندق معتمد")
            p["walk_mins_est"] = hp.get("walk_mins_est", max(2, round(dist_kaaba / 75.0)))
            if p.get("height", 0) < 45.0:
                p["height"] = 55.0 # realistic hotel height
            used_hotels.add(h_idx)
        else:
            # Assign realistic descriptive names based on street/zone
            if dist_kaaba <= 400:
                p["name_ar"] = f"فندق المنطقة المركزية (يبعد {dist_kaaba}م)"
                p["name_en"] = f"Central Area Hotel ({dist_kaaba}m)"
            elif dist_kaaba <= 700:
                p["name_ar"] = f"فندق أجياد والمشاة (يبعد {dist_kaaba}م)"
                p["name_en"] = f"Ajyad Pedestrian Hotel ({dist_kaaba}m)"
            else:
                p["name_ar"] = f"فندق ضيوف الرحمن ({dist_kaaba}م)"
                p["name_en"] = f"Pilgrim Hotel ({dist_kaaba}m)"

# Combine the new Abraj Al-Bait features at the beginning so they render first and prominently
all_features = new_features + b_data["features"]
b_data["features"] = all_features

print(f"Total buildings after enrichment and adding Abraj Al-Bait: {len(all_features)}")

# Save back to makkah_buildings_3d.geojson
with open(b_file, "w", encoding="utf-8") as f:
    json.dump(b_data, f, ensure_ascii=False, indent=2)

print("Saved enriched makkah_buildings_3d.geojson successfully!")
