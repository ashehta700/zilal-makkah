import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
elements = json.load(open('data/raw_roads.json', encoding='utf-8'))

print(f"Total elements: {len(elements)}")

named_streets = set()
types = {}
tunnels = 0

for el in elements:
    tags = el.get("tags", {})
    hw = tags.get("highway", "unknown")
    types[hw] = types.get(hw, 0) + 1
    if tags.get("tunnel") == "yes":
        tunnels += 1
    name_ar = tags.get("name:ar") or tags.get("name")
    name_en = tags.get("name:en")
    if name_ar:
        named_streets.add(name_ar)

print("Highway types:", types)
print(f"Tunnels: {tunnels}")
print(f"Named streets count: {len(named_streets)}")
print("\nSample named streets in Makkah:")
for s in sorted(named_streets):
    print(f" - {s}")
