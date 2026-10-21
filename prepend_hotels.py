import json
import os

HOTELS_FILE = os.path.join(os.path.dirname(__file__), "data", "makkah_hotels.geojson")
with open(HOTELS_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Priority landmark hotels around Al-Haram
priority_hotels = [
    {
        "type": "Feature",
        "id": "hotel_fairmont_clock_royal",
        "geometry": {"type": "Point", "coordinates": [39.82535, 21.41805]},
        "properties": {
            "name_ar": "برج فندق ساعة مكة الملكي (فيرمونت)",
            "name_en": "Makkah Clock Royal Tower - Fairmont",
            "stars": "5 نجوم فاخر",
            "rooms": "858",
            "dist_to_kaaba_meters": 490,
            "walk_mins_est": 6.0
        }
    },
    {
        "type": "Feature",
        "id": "hotel_zamzam_pullman",
        "geometry": {"type": "Point", "coordinates": [39.82485, 21.41835]},
        "properties": {
            "name_ar": "فندق بولمان زمزم مكة (برج زمزم)",
            "name_en": "Pullman ZamZam Makkah",
            "stars": "5 نجوم",
            "rooms": "1315",
            "dist_to_kaaba_meters": 440,
            "walk_mins_est": 5.5
        }
    },
    {
        "type": "Feature",
        "id": "hotel_hajar_movenpick",
        "geometry": {"type": "Point", "coordinates": [39.82460, 21.41775]},
        "properties": {
            "name_ar": "فندق موفنبيك برج هاجر مكة",
            "name_en": "Mövenpick Hotel Hajar Tower Makkah",
            "stars": "5 نجوم",
            "rooms": "1200",
            "dist_to_kaaba_meters": 495,
            "walk_mins_est": 6.0
        }
    },
    {
        "type": "Feature",
        "id": "hotel_swissotel_maqam",
        "geometry": {"type": "Point", "coordinates": [39.82585, 21.41820]},
        "properties": {
            "name_ar": "فندق سويس أوتيل المقام مكة",
            "name_en": "Swissôtel Al Maqam Makkah",
            "stars": "5 نجوم",
            "rooms": "1624",
            "dist_to_kaaba_meters": 470,
            "walk_mins_est": 5.8
        }
    },
    {
        "type": "Feature",
        "id": "hotel_raffles_safa",
        "geometry": {"type": "Point", "coordinates": [39.82510, 21.41900]},
        "properties": {
            "name_ar": "فندق قصر مكة رافلز (برج الصفا)",
            "name_en": "Raffles Makkah Palace",
            "stars": "5 نجوم فاخر",
            "rooms": "214",
            "dist_to_kaaba_meters": 385,
            "walk_mins_est": 4.8
        }
    },
    {
        "type": "Feature",
        "id": "hotel_rotana_marwah",
        "geometry": {"type": "Point", "coordinates": [39.82610, 21.41880]},
        "properties": {
            "name_ar": "فندق المروة ريحان من روتانا (برج المروة)",
            "name_en": "Al Marwa Rayhaan by Rotana",
            "stars": "5 نجوم",
            "rooms": "516",
            "dist_to_kaaba_meters": 370,
            "walk_mins_est": 4.5
        }
    },
    {
        "type": "Feature",
        "id": "hotel_conrad_jabal_omar",
        "geometry": {"type": "Point", "coordinates": [39.82100, 21.42150]},
        "properties": {
            "name_ar": "فندق كونراد مكة (جبل عمر)",
            "name_en": "Conrad Makkah Jabal Omar",
            "stars": "5 نجوم",
            "rooms": "438",
            "dist_to_kaaba_meters": 580,
            "walk_mins_est": 7.0
        }
    },
    {
        "type": "Feature",
        "id": "hotel_hilton_convention",
        "geometry": {"type": "Point", "coordinates": [39.82020, 21.42300]},
        "properties": {
            "name_ar": "فندق هيلتون مكة للمؤتمرات (جبل عمر)",
            "name_en": "Hilton Makkah Convention Hotel",
            "stars": "5 نجوم",
            "rooms": "764",
            "dist_to_kaaba_meters": 620,
            "walk_mins_est": 7.5
        }
    },
    {
        "type": "Feature",
        "id": "hotel_hyatt_regency",
        "geometry": {"type": "Point", "coordinates": [39.82200, 21.42250]},
        "properties": {
            "name_ar": "فندق جبل عمر حياة ريجنسي مكة",
            "name_en": "Jabal Omar Hyatt Regency Makkah",
            "stars": "5 نجوم",
            "rooms": "656",
            "dist_to_kaaba_meters": 490,
            "walk_mins_est": 6.0
        }
    },
    {
        "type": "Feature",
        "id": "hotel_address_jabal_omar",
        "geometry": {"type": "Point", "coordinates": [39.82150, 21.42080]},
        "properties": {
            "name_ar": "فندق العنوان جبل عمر مكة",
            "name_en": "Address Jabal Omar Makkah",
            "stars": "5 نجوم",
            "rooms": "1484",
            "dist_to_kaaba_meters": 560,
            "walk_mins_est": 6.8
        }
    }
]

# Filter out duplicates
existing = data.get("features", [])
p_names = {p["properties"]["name_ar"] for p in priority_hotels}
p_tokens = ["فيرمونت", "هاجر", "سويس اوتيل", "سويس أوتيل", "بولمان", "زمزم مكة", "رافلز"]

filtered = []
for f in existing:
    name = f["properties"].get("name_ar", "")
    if name not in p_names and not any(t in name for t in p_tokens):
        filtered.append(f)

data["features"] = priority_hotels + filtered

with open(HOTELS_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Updated {HOTELS_FILE}: {len(data['features'])} hotels total.")
