import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
b_data = json.load(open('data/makkah_buildings_3d.geojson', encoding='utf-8'))

print("Jabal Omar buildings:")
for i, f in enumerate(b_data['features']):
    p = f['properties']
    ring = f['geometry']['coordinates'][0]
    c_lon = sum(pt[0] for pt in ring) / len(ring)
    c_lat = sum(pt[1] for pt in ring) / len(ring)
    if 39.817 <= c_lon <= 39.823 and 21.419 <= c_lat <= 21.424:
        print(f"Building #{i+1:3d}: {p.get('name_ar')} | {p.get('height')}m | [{c_lon:.5f}, {c_lat:.5f}]")
