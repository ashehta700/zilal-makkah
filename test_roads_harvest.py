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
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

def query_overpass(query_str):
    encoded = urllib.parse.urlencode({"data": query_str})
    for server in OVERPASS_SERVERS:
        url = f"{server}?{encoded}"
        try:
            print(f"[*] Querying Overpass server: {server} ...")
            req = urllib.request.Request(url, headers={"User-Agent": "ZilalMakkahGIS/3.0"})
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                print(f"[+] Success! Received {len(data.get('elements', []))} elements.")
                return data
        except Exception as e:
            print(f"[-] Server {server} failed: {e}. Trying next...")
            time.sleep(1)
    return None

q = f"""
[out:json][timeout:45];
(
  way["highway"]({BBOX['south']},{BBOX['west']},{BBOX['north']},{BBOX['east']});
);
out body geom;
"""

data = query_overpass(q)
if data:
    elements = data.get("elements", [])
    print(f"Total highway ways: {len(elements)}")
    types = {}
    named = []
    for el in elements:
        tags = el.get("tags", {})
        hw = tags.get("highway", "unknown")
        types[hw] = types.get(hw, 0) + 1
        name = tags.get("name:ar") or tags.get("name")
        if name:
            named.append(name)
    print("Highway types:", types)
    print(f"Named roads count: {len(named)}")
    print("Sample names:", list(set(named))[:20])
