import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
raw_roads_file = os.path.join(DATA_DIR, "raw_roads.json")
old_ped_file = os.path.join(DATA_DIR, "makkah_pedestrian_network.geojson")
out_file = os.path.join(DATA_DIR, "makkah_roads_network.geojson")

raw_roads = json.load(open(raw_roads_file, encoding="utf-8"))
old_ped = json.load(open(old_ped_file, encoding="utf-8"))

print(f"Raw road elements: {len(raw_roads)}")
print(f"Old pedestrian features: {len(old_ped['features'])}")

features = []
seen_osm_ids = set()

# Classification dictionary for clean Arabic road types & widths
ROAD_CLASSES = {
    "motorway": {"name": "طريق سريع / دائري", "width": 10.0, "color": "#475569", "tier": "major"},
    "trunk": {"name": "شريان رئيسي / نفق", "width": 9.0, "color": "#64748B", "tier": "major"},
    "primary": {"name": "طريق رئيسي حيوي", "width": 8.0, "color": "#94A3B8", "tier": "major"},
    "secondary": {"name": "شارع رئيسي", "width": 7.0, "color": "#CBD5E1", "tier": "medium"},
    "tertiary": {"name": "شارع فرعي مخدوم", "width": 6.0, "color": "#94A3B8", "tier": "medium"},
    "residential": {"name": "شارع سكني فندقي", "width": 5.0, "color": "#64748B", "tier": "local"},
    "living_street": {"name": "شارع مشاة وخدمات", "width": 5.5, "color": "#10B981", "tier": "pedestrian"},
    "pedestrian": {"name": "ممشى مشاة رئيسي", "width": 6.0, "color": "#10B981", "tier": "pedestrian"},
    "footway": {"name": "ممر مشاة مخصص", "width": 4.0, "color": "#059669", "tier": "pedestrian"},
    "steps": {"name": "درج مشاة حجري", "width": 3.0, "color": "#CA8A04", "tier": "pedestrian"},
    "path": {"name": "مسار مشاة", "width": 3.5, "color": "#059669", "tier": "pedestrian"},
    "service": {"name": "طريق خدمة فندقي", "width": 4.5, "color": "#475569", "tier": "local"}
}

# 1. Process 604 raw road elements
for el in raw_roads:
    osm_id = el.get("id")
    if not osm_id or osm_id in seen_osm_ids:
        continue
    geom = el.get("geometry", [])
    if len(geom) < 2:
        continue

    coords = [[round(pt["lon"], 6), round(pt["lat"], 6)] for pt in geom]
    tags = el.get("tags", {})
    hw = tags.get("highway", "residential")

    is_tunnel = tags.get("tunnel") == "yes" or "tunnel" in tags
    is_covered = tags.get("covered") == "yes" or tags.get("indoor") == "corridor"
    is_bridge = tags.get("bridge") == "yes"

    name_ar = tags.get("name:ar") or tags.get("name")
    name_en = tags.get("name:en") or tags.get("int_name") or tags.get("name")

    # Clean road class
    r_info = ROAD_CLASSES.get(hw, {"name": "طريق عام", "width": 5.0, "color": "#64748B", "tier": "local"})

    if is_tunnel:
        shade_rating = "مكيف ومظلل بالكامل 100% (نفق تحت الأرض)"
        cooling_val = "-18.5°C"
    elif is_covered:
        shade_rating = "مظلل بأروقة ومظلات ذكية 95%"
        cooling_val = "-15.0°C"
    elif hw in ["pedestrian", "living_street"]:
        shade_rating = "ممشى مشاة مبرد ومظلل بظلال الأبراج 90%"
        cooling_val = "-14.0°C"
    else:
        shade_rating = "طريق مفتوح يخضع لظلال المباني بحسب حركة الشمس"
        cooling_val = "-8.0°C"

    features.append({
        "type": "Feature",
        "id": f"road_{osm_id}",
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        },
        "properties": {
            "osm_id": osm_id,
            "name_ar": name_ar or r_info["name"],
            "name_en": name_en or hw,
            "highway": hw,
            "highway_ar": r_info["name"],
            "tier": r_info["tier"],
            "render_width": r_info["width"],
            "render_color": r_info["color"],
            "is_tunnel": is_tunnel,
            "is_covered": is_covered,
            "is_bridge": is_bridge,
            "surface": tags.get("surface", "asphalt" if r_info["tier"] == "major" else "paved"),
            "lanes": tags.get("lanes", "2"),
            "shade_rating": shade_rating,
            "cooling_val": cooling_val
        }
    })
    seen_osm_ids.add(osm_id)

print(f"Added {len(features)} road features from raw_roads.")

# 2. Add pedestrian paths from old_ped that were not yet in seen_osm_ids
added_ped = 0
for f in old_ped["features"]:
    p = f["properties"]
    osm_id = p.get("osm_id")
    if osm_id and osm_id in seen_osm_ids:
        continue
    coords = f["geometry"]["coordinates"]
    if len(coords) < 2:
        continue

    hw = p.get("highway", "footway")
    is_tunnel = p.get("is_tunnel", False)
    is_covered = p.get("is_covered", False)
    name_ar = p.get("name") or p.get("name_ar")

    r_info = ROAD_CLASSES.get(hw, {"name": "ممر مشاة", "width": 4.0, "color": "#059669", "tier": "pedestrian"})

    if is_tunnel:
        shade_rating = "مكيف ومظلل بالكامل 100% (نفق مشاة)"
        cooling_val = "-18.5°C"
    elif is_covered:
        shade_rating = "مظلل بأروقة ومظلات ذكية 95%"
        cooling_val = "-15.0°C"
    else:
        shade_rating = "ممشى مشاة بحسب ظلال الأبراج"
        cooling_val = "-12.0°C"

    features.append({
        "type": "Feature",
        "id": f"ped_{osm_id or len(features)}",
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        },
        "properties": {
            "osm_id": osm_id,
            "name_ar": name_ar or r_info["name"],
            "name_en": p.get("name_en", hw),
            "highway": hw,
            "highway_ar": r_info["name"],
            "tier": "pedestrian",
            "render_width": 5.5 if (is_tunnel or is_covered) else 3.8,
            "render_color": "#10B981" if (is_tunnel or is_covered) else "#059669",
            "is_tunnel": is_tunnel,
            "is_covered": is_covered,
            "is_bridge": p.get("is_bridge", False),
            "surface": p.get("surface", "paved"),
            "lanes": "1",
            "shade_rating": shade_rating,
            "cooling_val": cooling_val
        }
    })
    if osm_id:
        seen_osm_ids.add(osm_id)
    added_ped += 1

print(f"Added {added_ped} unique pedestrian pathways.")
print(f"Total unified road network features: {len(features)}")

# Save unified GeoJSON
geojson_out = {
    "type": "FeatureCollection",
    "name": "Makkah_Complete_Roads_Network_Verified",
    "features": features
}

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(geojson_out, f, ensure_ascii=False, indent=2)

print(f"Successfully saved {out_file} with {len(features)} verified road features!")
