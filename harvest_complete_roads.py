import urllib.request
import urllib.parse
import json
import time

BBOX = {
    "south": 21.4120,
    "west": 39.8080,
    "north": 21.4320,
    "east": 39.8320
}

OVERPASS_SERVERS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter"
]

def query_overpass(query_str):
    encoded = urllib.parse.urlencode({"data": query_str})
    for server in OVERPASS_SERVERS:
        url = f"{server}?{encoded}"
        try:
            print(f"[*] Querying Overpass server: {server} ...")
            req = urllib.request.Request(url, headers={"User-Agent": "ZilalMakkahGIS/3.5"})
            with urllib.request.urlopen(req, timeout=35) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                elements = data.get("elements", [])
                print(f"[+] Success from {server}! Received {len(elements)} elements.")
                return elements
        except Exception as e:
            print(f"[-] Server {server} failed: {e}. Trying next...")
            time.sleep(1)
    return None

# Targeted query for all vehicular roads, avenues, tunnels, and pedestrian networks around Al-Haram
q = f"""
[out:json][timeout:35];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|living_street|pedestrian|service"]({BBOX['south']},{BBOX['west']},{BBOX['north']},{BBOX['east']});
);
out body geom;
"""

elements = query_overpass(q)
if elements:
    print(f"Total road elements retrieved: {len(elements)}")
    with open("data/raw_roads.json", "w", encoding="utf-8") as f:
        json.dump(elements, f, ensure_ascii=False)
else:
    print("Failed to fetch from overpass servers.")
