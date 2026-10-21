import json
import os
import urllib.request
import urllib.parse
import time

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

print("Checking Abraj Al-Bait and Clock Tower in OSM...")

# Query specifically for Abraj Al-Bait and Clock Tower
query = """[out:json][timeout:30];
(
  relation["name"~"أبراج البيت|Clock|ساعة"](21.412,39.815,21.428,39.835);
  way["name"~"أبراج البيت|Clock|ساعة|الصفوة|زمزم|هاجر"](21.412,39.815,21.428,39.835);
  relation["building"](21.416,39.822,21.423,39.829);
);
out body geom;
"""

encoded = urllib.parse.urlencode({"data": query})
url = f"https://overpass-api.de/api/interpreter?{encoded}"

try:
    req = urllib.request.Request(url, headers={"User-Agent": "ZilalMakkah/2.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        elements = data.get('elements', [])
        print(f"Received {len(elements)} elements from Overpass")
        for el in elements:
            tags = el.get('tags', {})
            print(f"- Type: {el.get('type')}, ID: {el.get('id')}, Name: {tags.get('name')}, Name:ar: {tags.get('name:ar')}, Height: {tags.get('height')}")
except Exception as e:
    print("Error querying Overpass:", e)
