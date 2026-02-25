#!/usr/bin/env python3
"""Generate/refresh Berlin dentist leads CSV using OpenStreetMap (Overpass API).

Writes:
  ../leads/berlin_dentists_leads.csv

Keeps existing rows and merges in new ones; de-dupes by (name, lat, lon) approx.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


OUT_COLUMNS = [
    "ClinicName",
    "Street",
    "HouseNumber",
    "Postcode",
    "City",
    "Phone",
    "Email",
    "Website",
    "Latitude",
    "Longitude",
    "GoogleMaps",
]


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _as_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


def _dedupe_key(name: str, lat: Optional[float], lon: Optional[float]) -> Tuple[str, Optional[int], Optional[int]]:
    """Key with coarse rounding to avoid near-duplicates.

    Used as a fallback when proximity-based merging can't decide.
    """
    n = name.casefold().strip()
    if lat is None or lon is None:
        return (n, None, None)
    return (n, int(round(lat * 1e5)), int(round(lon * 1e5)))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Earth radius (km)
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _row_completeness(r: Dict[str, str]) -> int:
    # Rough heuristic: count non-empty fields (excluding gmaps).
    score = 0
    for k in OUT_COLUMNS:
        if k == "GoogleMaps":
            continue
        if _norm(r.get(k)):
            score += 1
    return score


def read_existing(csv_path: Path) -> List[Dict[str, str]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for r in reader:
            rows.append({c: _norm(r.get(c, "")) for c in OUT_COLUMNS})
        return rows


def overpass_query() -> str:
    # Berlin state-level admin boundary (admin_level=4) is usually what people mean by "Berlin".
    # We query both amenity=dentist and healthcare=dentist.
    return r'''
[out:json][timeout:180];
area["name"="Berlin"]["boundary"="administrative"]["admin_level"="4"]->.searchArea;
(
  node["amenity"="dentist"](area.searchArea);
  way["amenity"="dentist"](area.searchArea);
  relation["amenity"="dentist"](area.searchArea);
  node["healthcare"="dentist"](area.searchArea);
  way["healthcare"="dentist"](area.searchArea);
  relation["healthcare"="dentist"](area.searchArea);
);
out center tags;
'''.strip()


def fetch_overpass_json(query: str) -> Dict[str, Any]:
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            "User-Agent": "openclaw-dentist-leads/1.0 (contact: local script)",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=240) as resp:
        raw = resp.read()

    return json.loads(raw.decode("utf-8"))


def element_to_row(el: Dict[str, Any]) -> Optional[Dict[str, str]]:
    tags = el.get("tags") or {}
    name = _norm(tags.get("name"))
    if not name:
        # Without a human-readable name, it's not a useful lead.
        return None

    if el.get("type") == "node":
        lat = el.get("lat")
        lon = el.get("lon")
    else:
        center = el.get("center") or {}
        lat = center.get("lat")
        lon = center.get("lon")

    lat_f = _as_float(lat)
    lon_f = _as_float(lon)

    street = _norm(tags.get("addr:street"))
    house = _norm(tags.get("addr:housenumber"))
    postcode = _norm(tags.get("addr:postcode"))
    city = _norm(tags.get("addr:city")) or "Berlin"

    phone = _norm(tags.get("contact:phone") or tags.get("phone"))
    email = _norm(tags.get("contact:email") or tags.get("email"))
    website = _norm(tags.get("contact:website") or tags.get("website"))

    gmaps = ""
    if lat_f is not None and lon_f is not None:
        gmaps = f"https://www.google.com/maps/search/?api=1&query={lat_f},{lon_f}"

    row = {
        "ClinicName": name,
        "Street": street,
        "HouseNumber": house,
        "Postcode": postcode,
        "City": city,
        "Phone": phone,
        "Email": email,
        "Website": website,
        "Latitude": "" if lat_f is None else f"{lat_f}",
        "Longitude": "" if lon_f is None else f"{lon_f}",
        "GoogleMaps": gmaps,
    }

    return row


def merge_rows(existing: List[Dict[str, str]], new_rows: Iterable[Dict[str, str]]) -> List[Dict[str, str]]:
    """Merge while aggressively de-duping OSM duplicates.

    Strategy:
    - Prefer merging rows that share the same name and are within ~150m.
    - If one row is missing coords, merge on name.
    - When merging, keep the row with higher completeness, but fill missing fields from the other.
    """

    out: List[Dict[str, str]] = []

    # Fallback seen set to catch exact-ish duplicates
    seen = set()

    # Index by normalized name -> list of indices in `out`
    by_name: Dict[str, List[int]] = {}

    def normalize_row(r: Dict[str, str]) -> Dict[str, str]:
        nr = {c: _norm(r.get(c, "")) for c in OUT_COLUMNS}
        # If coords exist, ensure GoogleMaps is consistent.
        lat = _as_float(nr.get("Latitude"))
        lon = _as_float(nr.get("Longitude"))
        if lat is not None and lon is not None:
            nr["GoogleMaps"] = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
        return nr

    def merge_into(base: Dict[str, str], incoming: Dict[str, str]) -> Dict[str, str]:
        # Fill missing fields on base from incoming.
        for c in OUT_COLUMNS:
            if not _norm(base.get(c)) and _norm(incoming.get(c)):
                base[c] = incoming[c]
        # Recompute GoogleMaps if base now has coords.
        lat = _as_float(base.get("Latitude"))
        lon = _as_float(base.get("Longitude"))
        if lat is not None and lon is not None:
            base["GoogleMaps"] = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
        return base

    def maybe_merge_or_add(r: Dict[str, str]):
        nr = normalize_row(r)
        name = _norm(nr.get("ClinicName"))
        if not name:
            return

        nkey = name.casefold().strip()
        lat = _as_float(nr.get("Latitude"))
        lon = _as_float(nr.get("Longitude"))

        # Try to merge with existing rows of the same name.
        candidates = by_name.get(nkey, [])
        best_i: Optional[int] = None
        best_dist = None

        for i in candidates:
            existing_row = out[i]
            elat = _as_float(existing_row.get("Latitude"))
            elon = _as_float(existing_row.get("Longitude"))

            if lat is None or lon is None or elat is None or elon is None:
                # If one lacks coords, treat as mergeable (same name).
                best_i = i
                best_dist = 0.0
                break

            d = _haversine_km(lat, lon, elat, elon)
            if d <= 0.15 and (best_dist is None or d < best_dist):
                best_i = i
                best_dist = d

        if best_i is not None:
            # Merge into the more complete row.
            a = out[best_i]
            b = nr
            if _row_completeness(b) > _row_completeness(a):
                a, b = b, a
                out[best_i] = a
            out[best_i] = merge_into(out[best_i], b)
            return

        # Fallback: avoid exact-ish duplicates.
        fkey = _dedupe_key(name, lat, lon)
        if fkey in seen:
            return
        seen.add(fkey)

        by_name.setdefault(nkey, []).append(len(out))
        out.append(nr)

    for r in existing:
        if _norm(r.get("ClinicName")):
            maybe_merge_or_add(r)

    for r in new_rows:
        if _norm(r.get("ClinicName")):
            maybe_merge_or_add(r)

    out.sort(key=lambda r: r["ClinicName"].casefold())
    return out


def write_csv(path: Path, rows: List[Dict[str, str]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLUMNS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)


def main() -> int:
    here = Path(__file__).resolve()
    project_dir = here.parents[1]
    out_csv = project_dir / "leads" / "berlin_dentists_leads.csv"

    existing = read_existing(out_csv)

    query = overpass_query()
    data = fetch_overpass_json(query)
    elements = data.get("elements") or []

    converted: List[Dict[str, str]] = []
    for el in elements:
        row = element_to_row(el)
        if row is not None:
            converted.append(row)

    merged = merge_rows(existing, converted)
    write_csv(out_csv, merged)

    print(f"Existing: {len(existing)} rows")
    print(f"From OSM: {len(converted)} named dentist features")
    print(f"Wrote:    {len(merged)} rows -> {out_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
