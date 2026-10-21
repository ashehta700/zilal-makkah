import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
from shapely.geometry import shape, LineString, Point

# Load GIS datasets
buildings_data = json.load(open(r'C:\Users\asheh\.gemini\antigravity\scratch\zilal-makkah\data\makkah_buildings_3d.geojson', encoding='utf-8'))
hotels_data = json.load(open(r'C:\Users\asheh\.gemini\antigravity\scratch\zilal-makkah\data\makkah_hotels.geojson', encoding='utf-8'))

b_polys = []
for f in buildings_data['features']:
    poly = shape(f['geometry'])
    name = f['properties'].get('name_ar') or f['properties'].get('name') or 'Bldg'
    b_polys.append((poly, name))

print(f"Loaded {len(b_polys)} building polygons and {len(hotels_data['features'])} hotels.")

# 1. Ibrahim Al-Khalil Main Spine (Verified 0-collision)
KHALIL_SPINE = [
    [39.82285, 21.41650],
    [39.82285, 21.41780],
    [39.82272, 21.41890],
    [39.82260, 21.42020],
    [39.82217, 21.42130],
    [39.82195, 21.42180] # Shubaika Portal
]

# 2. Western Piazza Concourse to Bab King Fahd #79 (Verified 0-collision)
WEST_PIAZZA_TO_FAHD = [
    [39.82195, 21.42180],
    [39.82250, 21.42190],
    [39.82330, 21.42210],
    [39.82395, 21.42242],
    [39.82420, 21.42250] # Bab King Fahd #79
]

# 3. Abraj Al-Bait North Concourse to Bab King Abdulaziz #1 (Verified 0-collision)
ABRAJ_TO_ABDULAZIZ = [
    [39.82540, 21.41900], # North Plaza Exit
    [39.82560, 21.42000],
    [39.82600, 21.42050],
    [39.82625, 21.42080] # Bab King Abdulaziz #1
]

# 4. Safwah / Dar Al-Eiman Concourse to Bab King Abdulaziz #1 (Verified 0-collision)
SAFWAH_TO_ABDULAZIZ = [
    [39.82640, 21.42020], # Safwah Piazza
    [39.82625, 21.42080]  # Bab King Abdulaziz #1
]

# 5. Ajyad Street Corridor to Bab King Abdulaziz #1 (Verified 0-collision)
AJYAD_SPINE = [
    [39.82805, 21.41715],
    [39.82780, 21.41780],
    [39.82750, 21.41870],
    [39.82745, 21.41940],
    [39.82745, 21.42010],
    [39.82710, 21.42040],
    [39.82667, 21.42040],
    [39.82625, 21.42080]  # Bab King Abdulaziz #1
]

# 6. Jabal Al-Kaaba / Umm Al-Qura Corridor to King Fahd Gate (Verified 0-collision)
KAABA_SPINE_TO_FAHD = [
    [39.81997, 21.42548],
    [39.82059, 21.42430],
    [39.82130, 21.42300],
    [39.82180, 21.42220],
    [39.82195, 21.42180],
    [39.82250, 21.42190],
    [39.82330, 21.42210],
    [39.82420, 21.42250]  # Bab King Fahd #79
]

# 7. Ghazza / Masaa Eastern Corridor to Bab Al-Salam #19 (Verified 0-collision)
GHAZZA_SPINE_TO_SALAM = [
    [39.82930, 21.42600],
    [39.82930, 21.42440], # completely south of Qashashiyyah
    [39.82850, 21.42400],
    [39.82770, 21.42340]  # Bab Al-Salam #19
]

# 8. Jabal Omar Upper Ridge Spine (DoubleTree, Hilton Suites, Marriott)
JABAL_OMAR_RIDGE_TO_FAHD = [
    [39.817715, 21.424025], [39.817962, 21.423664], [39.818996, 21.422984], [39.819400, 21.422553],
    [39.820298, 21.421094], [39.820810, 21.419207], [39.822517, 21.420236], [39.822600, 21.420200],
    [39.822170, 21.421300], [39.821950, 21.421800], [39.822500, 21.421900], [39.823300, 21.422100],
    [39.824200, 21.422500]
]

def clean_route(route):
    cleaned = []
    for pt in route:
        if not cleaned or (abs(pt[0] - cleaned[-1][0]) > 1e-6 or abs(pt[1] - cleaned[-1][1]) > 1e-6):
            cleaned.append([round(pt[0], 6), round(pt[1], 6)])
    return cleaned

def generate_street_route_for_hotel(hotel):
    hname = hotel['properties'].get('name_ar') or hotel['properties'].get('name') or ''
    start = hotel['geometry']['coordinates']
    lon, lat = start[0], start[1]

    # 1. Special: Dar Al-Tawhid Intercontinental
    if 'التوحيد' in hname:
        street_pt = [39.82280, 21.42150]
        return clean_route([street_pt] + WEST_PIAZZA_TO_FAHD[1:]), 'gate_king_fahd', 'west', 'باب الملك فهد (رقم 79)'

    # 2. Special: DoubleTree by Hilton Jabal Omar
    if 'دبل' in hname:
        street_pt = [39.817962, 21.423664]
        return clean_route([street_pt] + JABAL_OMAR_RIDGE_TO_FAHD[2:]), 'gate_king_fahd', 'west', 'باب الملك فهد (رقم 79)'

    # 3. Abraj Al-Bait & Safwah Grand Southern Piazza Zone
    if (lon >= 39.8242 and lon <= 39.8272 and lat <= 21.4202) or any(k in hname for k in ['ساعة مكة', 'فيرمونت', 'زمزم', 'هاجر', 'المقام', 'سويس أوتيل', 'رافلز', 'المروة', 'الصفوة', 'أبراج البيت', 'رويال أوركيد', 'الإيمان رويال']):
        if lon >= 39.8263:
            street_pt = [39.82640, 21.42020]
            return clean_route([street_pt, [39.82625, 21.42080]]), 'gate_abdulaziz', 'south_abraj', 'باب الملك عبدالعزيز (رقم 1)'
        else:
            street_pt = [39.82540, 21.41900]
            return clean_route([street_pt] + ABRAJ_TO_ABDULAZIZ[1:]), 'gate_abdulaziz', 'south_abraj', 'باب الملك عبدالعزيز (رقم 1)'

    # 4. Sector: West (Ibrahim Al-Khalil / Jabal Omar)
    if lon < 39.8242 and lat <= 21.4230:
        k_nodes = [pt for pt in KHALIL_SPINE if pt[1] >= lat - 0.0005]
        if not k_nodes:
            k_nodes = [KHALIL_SPINE[-1]]
        first_node = k_nodes[0]
        street_pt = [first_node[0], max(lat, first_node[1])]
        
        route = [street_pt]
        for node in KHALIL_SPINE:
            if node[1] > street_pt[1]:
                route.append(node)
        route.extend(WEST_PIAZZA_TO_FAHD[1:])
        return clean_route(route), 'gate_king_fahd', 'west', 'باب الملك فهد (رقم 79)'

    # 5. Sector: South Ajyad
    elif lon >= 39.8268 and lat <= 21.4220:
        clean_lat = min(lat, 21.42020)
        a_nodes = [pt for pt in AJYAD_SPINE if pt[1] >= clean_lat - 0.0005]
        if not a_nodes:
            a_nodes = [AJYAD_SPINE[-1]]
        first_node = a_nodes[0]
        street_pt = [first_node[0], max(clean_lat, first_node[1])]
        
        route = [street_pt]
        for node in AJYAD_SPINE:
            if node[1] > street_pt[1]:
                route.append(node)
        if route[-1] != [39.82625, 21.42080]:
            route.append([39.82625, 21.42080])
        return clean_route(route), 'gate_abdulaziz', 'south_ajyad', 'باب الملك عبدالعزيز (رقم 1)'

    # 6. Sector: North (Jabal Al-Kaaba / Shamiyah)
    elif lat > 21.4230 and lon <= 39.8265:
        step_lat = min(lat, 21.42548)
        street_pt = [39.81997, step_lat]
        route = [street_pt]
        for node in KAABA_SPINE_TO_FAHD:
            if node[1] < step_lat:
                route.append(node)
        route.extend(KAABA_SPINE_TO_FAHD[4:])
        return clean_route(route), 'gate_king_fahd', 'north', 'باب الملك فهد (رقم 79)'

    # 7. Sector: East (Ghazza / Masaa)
    else:
        step_lat = min(lat, 21.42600)
        street_pt = [39.82930, step_lat]
        route = [street_pt]
        for node in GHAZZA_SPINE_TO_SALAM:
            if node[1] < step_lat:
                route.append(node)
        if route[-1] != [39.82770, 21.42340]:
            route.append([39.82770, 21.42340])
        return clean_route(route), 'gate_salam', 'east', 'باب السلام (رقم 19)'

# Run validation across all 271 hotels
collisions = 0
culprits = []

for idx, h in enumerate(hotels_data['features']):
    hname = h['properties'].get('name_ar') or h['properties'].get('name') or f'Hotel_{idx}'
    route, gate_id, sector, gate_name = generate_street_route_for_hotel(h)
    
    line = LineString(route)
    hits = [bname for poly, bname in b_polys if line.intersects(poly)]
    if hits:
        collisions += 1
        culprits.append((hname, hits))

print(f"\n==========================================")
print(f"RESULTS: {len(hotels_data['features'])} hotels tested.")
print(f"Total Collisions with Buildings: {collisions}")
print(f"==========================================")

if culprits:
    print(f"Collisions ({len(culprits)}):", culprits[:5])
else:
    print("SUCCESS: 100% OF ALL 271 HOTELS HAVE ZERO BUILDING COLLISIONS!")
