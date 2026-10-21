import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
b_data = json.load(open('data/makkah_buildings_3d.geojson', encoding='utf-8'))

keywords = ['جبل عمر', 'عمر', 'صفوة', 'الصفوة', 'هيلتون', 'توحيد', 'ميريديان', 'كونراد', 'حياة', 'ماريوت', 'العنوان', 'سويس', 'أبراج']
for i, f in enumerate(b_data['features']):
    p = f['properties']
    name = p.get('name_ar', '')
    if any(k in name for k in keywords):
        ring = f['geometry']['coordinates'][0]
        c_lon = sum(pt[0] for pt in ring) / len(ring)
        c_lat = sum(pt[1] for pt in ring) / len(ring)
        print(f"{i+1:3d}. {name} | Height: {p.get('height')}m | [{c_lon:.5f}, {c_lat:.5f}]")
