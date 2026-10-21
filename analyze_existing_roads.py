import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open('data/makkah_pedestrian_network.geojson', encoding='utf-8'))
features = data['features']

print(f"Total existing features: {len(features)}")

# Check coordinate bounds
all_lons = []
all_lats = []
for f in features:
    geom = f.get('geometry', {})
    coords = geom.get('coordinates', [])
    for pt in coords:
        all_lons.append(pt[0])
        all_lats.append(pt[1])

print(f"BBox: Lon [{min(all_lons):.5f}, {max(all_lons):.5f}], Lat [{min(all_lats):.5f}, {max(all_lats):.5f}]")

# Named streets and tunnels
named_dict = {}
for f in features:
    p = f['properties']
    name = p.get('name') or p.get('name_ar')
    if name and name != 'ممر مشاة':
        hw = p.get('highway', 'unknown')
        if name not in named_dict:
            named_dict[name] = {"count": 0, "types": set(), "tunnel": p.get('is_tunnel', False)}
        named_dict[name]["count"] += 1
        named_dict[name]["types"].add(hw)

print(f"\nUnique Named Streets/Tunnels: {len(named_dict)}")
for name, info in sorted(named_dict.items(), key=lambda x: x[1]['count'], reverse=True):
    print(f" - {name:35s} | Segments: {info['count']:2d} | Types: {list(info['types'])} | Tunnel: {info['tunnel']}")
