import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
in_file = os.path.join(DATA_DIR, "makkah_roads_network.geojson")
out_file = os.path.join(DATA_DIR, "makkah_roads_network.geojson")

data = json.load(open(in_file, encoding="utf-8"))
features = data["features"]

print(f"Loaded {len(features)} road features.")

# Specific real physical widths in Makkah (meters)
ROAD_SPECS = {
    "طريق الملك عبدالعزيز": {"width": 24.0, "ped_allowed": True, "type": "boulevard", "sidewalk": 5.0},
    "طريق أم القرى": {"width": 20.0, "ped_allowed": True, "type": "avenue", "sidewalk": 4.5},
    "شَارِع إبراهيم الخليل": {"width": 18.0, "ped_allowed": True, "type": "avenue", "sidewalk": 4.5},
    "شارع أجياد": {"width": 14.0, "ped_allowed": True, "type": "avenue", "sidewalk": 3.5},
    "شارع جبل الكعبة": {"width": 16.0, "ped_allowed": True, "type": "avenue", "sidewalk": 3.5},
    "الدائري الأول": {"width": 18.0, "ped_allowed": False, "type": "expressway", "sidewalk": 0.0},
    "الدائري الثاني": {"width": 22.0, "ped_allowed": False, "type": "expressway", "sidewalk": 0.0},
    "نفق السوق الصغير": {"width": 12.0, "ped_allowed": False, "type": "tunnel_vehicular", "sidewalk": 0.0}, # Vehicular underpass
    "نفق كدي أجياد": {"width": 12.0, "ped_allowed": False, "type": "tunnel_vehicular", "sidewalk": 0.0},
    "نفق ريع بخش": {"width": 12.0, "ped_allowed": False, "type": "tunnel_vehicular", "sidewalk": 0.0},
    "طريق المدينة المنورة": {"width": 24.0, "ped_allowed": False, "type": "highway", "sidewalk": 0.0},
    "طريق المسيال": {"width": 12.0, "ped_allowed": True, "type": "pedestrian_priority", "sidewalk": 6.0},
    "طريق المسجد الحرام": {"width": 16.0, "ped_allowed": True, "type": "pedestrian_priority", "sidewalk": 5.0},
    "طريق المشاة": {"width": 10.0, "ped_allowed": True, "type": "pedestrian_only", "sidewalk": 10.0},
    "المسعى بين الصفا والمروة": {"width": 16.0, "ped_allowed": True, "type": "masaa_sacred", "sidewalk": 16.0},
    "طواف": {"width": 20.0, "ped_allowed": True, "type": "mataf_sacred", "sidewalk": 20.0},
    "طواف الدور الأول": {"width": 12.0, "ped_allowed": True, "type": "mataf_sacred", "sidewalk": 12.0},
    "جسر الصفا": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_bridge", "sidewalk": 8.0},
    "جسر أجياد": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_bridge", "sidewalk": 8.0},
    "جسر الشبيكة": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_bridge", "sidewalk": 8.0},
    "جسر باب النبي": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_bridge", "sidewalk": 8.0},
    "Jarwal Tunnel": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_tunnel", "sidewalk": 8.0},
    "Bab Al Malik Al Misyal Tunnel": {"width": 7.0, "ped_allowed": True, "type": "pedestrian_tunnel", "sidewalk": 7.0},
    "Hujun Tunnel": {"width": 8.0, "ped_allowed": True, "type": "pedestrian_tunnel", "sidewalk": 8.0}
}

forbidden_count = 0
pedestrian_count = 0
shared_count = 0

for f in features:
    p = f["properties"]
    name_ar = p.get("name_ar", "").strip()
    hw = p.get("highway", "residential")
    is_tunnel = p.get("is_tunnel", False)
    is_covered = p.get("is_covered", False)

    # 1. Check if explicitly in ROAD_SPECS
    matched_spec = None
    for spec_name, spec in ROAD_SPECS.items():
        if spec_name in name_ar:
            matched_spec = spec
            break

    if matched_spec:
        width = matched_spec["width"]
        ped_allowed = matched_spec["ped_allowed"]
        sidewalk_w = matched_spec["sidewalk"]
        road_type = matched_spec["type"]
    else:
        # Default by highway type
        if hw in ["motorway", "motorway_link"]:
            width = 18.0
            ped_allowed = False
            sidewalk_w = 0.0
            road_type = "expressway"
        elif hw in ["trunk", "trunk_link"]:
            width = 14.0
            ped_allowed = False if is_tunnel else True
            sidewalk_w = 0.0 if is_tunnel else 3.0
            road_type = "trunk"
        elif hw in ["primary", "primary_link"]:
            width = 14.0
            ped_allowed = False if is_tunnel else True
            sidewalk_w = 0.0 if is_tunnel else 3.5
            road_type = "avenue"
        elif hw in ["secondary", "tertiary"]:
            width = 10.0
            ped_allowed = True
            sidewalk_w = 2.5
            road_type = "local_street"
        elif hw in ["pedestrian", "living_street"]:
            width = 8.0
            ped_allowed = True
            sidewalk_w = 8.0
            road_type = "pedestrian_avenue"
        elif hw in ["footway", "path"]:
            width = 4.5
            ped_allowed = True
            sidewalk_w = 4.5
            road_type = "pedestrian_walkway"
        elif hw == "steps":
            width = 3.5
            ped_allowed = True
            sidewalk_w = 3.5
            road_type = "pedestrian_steps"
        elif hw == "service":
            width = 6.0
            ped_allowed = True
            sidewalk_w = 1.5
            road_type = "service_alley"
        else:
            width = 8.0
            ped_allowed = True
            sidewalk_w = 2.0
            road_type = "residential_street"

    # Set pedestrian status text and rules
    if not ped_allowed:
        ped_status = "forbidden"
        ped_status_ar = "🚫 ممنوع سير المشاة قطيعاً (طريق سريع / نفق مركبات فقط)"
        ped_status_desc = "طريق مخصص للمركبات والحافلات السريعة فقط. يمنع مرور المشاة منعاً باتاً لسلامتهم."
        render_color = "#334155" # Dark asphalt
        forbidden_count += 1
    elif sidewalk_w >= width - 1.0:
        ped_status = "exclusive"
        ped_status_ar = "🚶 مخصص للمشاة 100% (آمن ومحمي تماماً)"
        ped_status_desc = "مسار مخصص لضيوف الرحمن والمشاة فقط وممنوع لدخول المركبات."
        render_color = "#10B981" if (is_tunnel or is_covered) else "#059669"
        pedestrian_count += 1
    else:
        ped_status = "sidewalk_only"
        ped_status_ar = "🚶 رصيف مشاة مخصص بجانب الشارع (المشي على الرصيف المظلل فقط)"
        ped_status_desc = f"شارع شرياني عريض ({width:.0f}م). المشي مسموح ومخصص على الأرصفة الجانبية ({sidewalk_w:.1f}م) المستترة بظلال الأبراج."
        render_color = "#475569" # Paved Avenue with designated sidewalks
        shared_count += 1

    # Update properties
    p["physical_width_meters"] = width
    p["sidewalk_width_meters"] = sidewalk_w
    p["pedestrian_allowed"] = ped_allowed
    p["pedestrian_status"] = ped_status
    p["pedestrian_status_ar"] = ped_status_ar
    p["pedestrian_status_desc"] = ped_status_desc
    p["road_type"] = road_type
    p["render_color"] = render_color

print(f"Classification Summary:")
print(f" - 🚫 Forbidden for Pedestrians (Vehicles/Expressway only): {forbidden_count} segments")
print(f" - 🚶 100% Dedicated Pedestrian Walkways/Plazas: {pedestrian_count} segments")
print(f" - 🚶 Shared Avenues with Dedicated Shaded Sidewalks: {shared_count} segments")

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Successfully updated {out_file} with full physical widths and pedestrian safety rules!")
