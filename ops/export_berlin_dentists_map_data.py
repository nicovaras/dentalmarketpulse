#!/usr/bin/env python3
"""Export dentist leads to lightweight JSON for landing-page map.

Input:
  ../leads/berlin_dentists_leads.csv
Output:
  ../landing/assets/berlin_dentists_map.json

Notes:
- Map only needs: name, lat, lon, address (optional), website (optional), google maps link.
- Filters to an approximate Berlin bounding box to avoid metro-area spillover.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Dict, List, Optional


BERLIN_BBOX = {
    "min_lat": 52.3383,
    "max_lat": 52.6755,
    "min_lon": 13.0884,
    "max_lon": 13.7612,
}


def f(x: str) -> Optional[float]:
    try:
        x = (x or "").strip()
        if not x:
            return None
        return float(x)
    except Exception:
        return None


def in_berlin(lat: float, lon: float) -> bool:
    return (
        BERLIN_BBOX["min_lat"] <= lat <= BERLIN_BBOX["max_lat"]
        and BERLIN_BBOX["min_lon"] <= lon <= BERLIN_BBOX["max_lon"]
    )


def norm(s: str) -> str:
    return (s or "").strip()


def main() -> int:
    here = Path(__file__).resolve()
    project_dir = here.parents[1]

    src = project_dir / "leads" / "berlin_dentists_leads.csv"
    out = project_dir / "landing" / "assets" / "berlin_dentists_map.json"
    out.parent.mkdir(parents=True, exist_ok=True)

    items: List[Dict[str, str]] = []

    with src.open("r", encoding="utf-8", newline="") as f_in:
        reader = csv.DictReader(f_in)
        for r in reader:
            name = norm(r.get("ClinicName", ""))
            lat = f(r.get("Latitude", ""))
            lon = f(r.get("Longitude", ""))
            if not name or lat is None or lon is None:
                continue
            if not in_berlin(lat, lon):
                continue

            street = norm(r.get("Street", ""))
            house = norm(r.get("HouseNumber", ""))
            postcode = norm(r.get("Postcode", ""))
            city = norm(r.get("City", "")) or "Berlin"
            addr = " ".join([p for p in [street, house] if p])
            if postcode or city:
                addr = (addr + ", " if addr else "") + " ".join([p for p in [postcode, city] if p])

            website = norm(r.get("Website", ""))
            gmaps = norm(r.get("GoogleMaps", ""))

            items.append(
                {
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "address": addr,
                    "website": website,
                    "gmaps": gmaps,
                }
            )

    # Stable-ish order
    items.sort(key=lambda x: x["name"].casefold())

    payload = {
        "source": "OpenStreetMap via Overpass API (exported locally)",
        "bbox": BERLIN_BBOX,
        "count": len(items),
        "items": items,
    }

    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(items)} points -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
