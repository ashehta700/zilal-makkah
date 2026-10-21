import sys
import json
import os
import math

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
b_file = os.path.join(DATA_DIR, "makkah_buildings_3d.geojson")
h_file = os.path.join(DATA_DIR, "makkah_hotels.geojson")

b_data = json.load(open(b_file, encoding="utf-8"))
h_data = json.load(open(h_file, encoding="utf-8"))

print(f"Loaded {len(b_data['features'])} buildings and {len(h_data['features'])} hotels.")

# Build dictionary of hotels by building_osm_id
hotels_by_bid = {}
for hf in h_data["features"]:
    p = hf["properties"]
    bid = str(p.get("building_osm_id", ""))
    if bid:
        hotels_by_bid[bid] = p

print(f"Mapped {len(hotels_by_bid)} hotels by building_osm_id.")

# Enrich all 3D buildings directly with full hotel metadata
hotel_buildings_count = 0
for bf in b_data["features"]:
    props = bf["properties"]
    osm_id = str(props.get("osm_id", ""))
    
    # Check if this building has hotel data
    if osm_id in hotels_by_bid:
        hp = hotels_by_bid[osm_id]
        props["is_hotel"] = True
        props["name_ar"] = hp["name_ar"]
        props["name_en"] = hp["name_en"]
        props["stars"] = hp["stars"]
        props["rooms"] = hp["rooms"]
        props["dist_to_kaaba_meters"] = hp["dist_to_kaaba_meters"]
        props["walk_mins_est"] = hp["walk_mins_est"]
        props["is_landmark"] = hp.get("is_landmark", props.get("is_landmark", False))
        hotel_buildings_count += 1
    elif "فندق" in props.get("name_ar", "") or "برج" in props.get("name_ar", ""):
        props["is_hotel"] = True
        hotel_buildings_count += 1

print(f"Total 3D buildings now classified as hotels with complete data: {hotel_buildings_count}")

# Save enriched 3D buildings
with open(b_file, "w", encoding="utf-8") as f:
    json.dump(b_data, f, ensure_ascii=False, indent=2)

print(f"Successfully saved updated {b_file}")
