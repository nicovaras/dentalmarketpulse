/* Landing (Leaflet + markercluster)
   Data: assets/berlin_dentists_map.json

   Product-like map mode:
   - user enters area/address
   - we geocode via Nominatim
   - show nearest 8–15 clinics around the point
*/

const STRINGS = {
  de: {
    brand: "DentalMarketPulse",
    title: "Wettbewerbsreport für Berliner Zahnärzte",
    subtitle:
      "Monatliche Einblicke zu lokalen Wettbewerbern — Bewertungen, Preis-/Angebotssignale und SEO‑Lücken — plus 5 konkrete Handlungsempfehlungen.",
    cta: "Beispielreport anfordern",
    ctaMap: "Wettbewerbs-Landkarte ansehen",
    ctaPrefill: "Ich hätte gern einen Beispielreport für meine Praxis.",
    sampleBtnEn: "Sample (EN)",
    sampleBtnDe: "Sample (DE)",
    badges: ["Öffentliche Daten", "Berlin-fokussiert", "5-Punkte-Plan"],

    whatTitle: "Was Sie bekommen",
    what: [
      "Wettbewerbsübersicht: 8–15 relevante Praxen in Ihrer Nähe",
      "Bewertungstrends: Lob & häufige Kritikpunkte",
      "Angebots-/Preissignale: Änderungen aus öffentlichen Quellen",
      "SEO‑Lücken: Keywords, bei denen Wettbewerber ranken",
      "5‑Punkte‑Plan: klare Maßnahmen für diesen Monat",
    ],

    mapTitle: "Wettbewerbs-Landkarte (Berlin)",
    mapHint:
      "Tipp: Geben Sie Ihren Bezirk ein, um die 15 nächsten Wettbewerber zu sehen.",
    mapSearchPlaceholder: "z.B. Prenzlauer Berg, Friedrichstraße 123",
    mapSearchBtn: "Suchen",
    mapShowAllBtn: "Alle anzeigen",
    mapStatusAll: (n) => `Alle Punkte: ${n}`,
    mapStatusNearest: (k, q) => `Zeige ${k} nächste Praxen zu: ${q}`,
    mapStatusError: "Adresse nicht gefunden. Bitte präziser versuchen.",

    countLabel: "Praxen auf der Karte",

    pricingTitle: "Preise",
    pricePilotName: "Pilotmonat",
    pricePilotValue: "99 €",
    pricePilotDesc: "Erster Report (3–5 Werktage) + 5 konkrete Empfehlungen.",
    priceOngoingName: "Danach monatlich",
    priceOngoingValue: "149–299 €",
    priceOngoingDesc: "Abhängig von Praxisgröße / gewünschter Tiefe.",
    pricingCta: "Beispielreport anfordern",

    faqTitle: "FAQ",
    faq: [
      {
        q: "Ist das legal?",
        a: "Ja — wir nutzen ausschließlich öffentliche Informationen.",
      },
      { q: "Wie lange dauert der erste Report?", a: "In der Regel 3–5 Werktage." },
      { q: "Brauchen Sie Zugriff auf meine Accounts?", a: "Nein." },
    ],

    formNote:
      "Formular läuft über Formspree (oder Mail-Fallback). Für Produktion bitte Endpoint setzen.",
    formAlert: "Danke! Wir melden uns per E‑Mail.",
    formTitle: "Beispielreport anfordern",
    form: {
      clinic: "Praxisname",
      website: "Website (optional)",
      area: "Stadt/Bezirk",
      email: "Kontakt‑E‑Mail",
      notes: "Kurz: Was ist Ihnen wichtig? (optional)",
      send: "Anfrage senden",
    },

    legal:
      "Hinweis: Wir nutzen ausschließlich öffentliche Informationen. OpenStreetMap-Karte © OpenStreetMap-Mitwirkende.",
  },

  en: {
    brand: "DentalMarketPulse",
    title: "Berlin Dentist Competitor Intelligence Report",
    subtitle:
      "Monthly insights on nearby clinics — reviews, pricing signals, and SEO gaps — with a 5‑point action list.",
    cta: "Request a Sample Report",
    ctaMap: "View the competitor map",
    ctaPrefill: "I’d like a sample competitor report for my clinic.",
    sampleBtnEn: "Sample (EN)",
    sampleBtnDe: "Sample (DE)",
    badges: ["Public data", "Berlin-focused", "5‑point action plan"],

    whatTitle: "What you get",
    what: [
      "Competitor overview: 8–15 relevant clinics nearby",
      "Review trends: what patients love/complain about",
      "Offer changes: pricing/service shifts (public info)",
      "SEO gaps: keywords competitors rank for",
      "Action list: 5 concrete improvements for this month",
    ],

    mapTitle: "Competitor map (Berlin)",
    mapHint: "Tip: enter your area to see the 15 nearest competitors.",
    mapSearchPlaceholder: "e.g. Prenzlauer Berg, Friedrichstraße 123",
    mapSearchBtn: "Search",
    mapShowAllBtn: "Show all",
    mapStatusAll: (n) => `All points: ${n}`,
    mapStatusNearest: (k, q) => `Showing ${k} nearest clinics to: ${q}`,
    mapStatusError: "We couldn't find that address. Try a more specific query.",

    countLabel: "clinics on the map",

    pricingTitle: "Pricing",
    pricePilotName: "Pilot month",
    pricePilotValue: "€99",
    pricePilotDesc: "First report (3–5 business days) + 5 concrete recommendations.",
    priceOngoingName: "Ongoing monthly",
    priceOngoingValue: "€149–€299",
    priceOngoingDesc: "Depends on clinic size / desired depth.",
    pricingCta: "Request a Sample Report",

    faqTitle: "FAQ",
    faq: [
      { q: "Is this legal?", a: "Yes — we only use public information." },
      { q: "How long does the first report take?", a: "Usually 3–5 business days." },
      { q: "Do you need access to my accounts?", a: "No." },
    ],

    formNote:
      "Form uses Formspree (or a mail fallback). For production, set your endpoint.",
    formAlert: "Thanks! We'll get back to you via email.",
    formTitle: "Request a Sample Report",
    form: {
      clinic: "Clinic name",
      website: "Website (optional)",
      area: "City/Area",
      email: "Contact email",
      notes: "Anything you care about? (optional)",
      send: "Send request",
    },

    legal:
      "Note: We only use public information. OpenStreetMap tiles © OpenStreetMap contributors.",
  },
};

function $(id) {
  return document.getElementById(id);
}

let map;
let cluster;
let currentLang = "de";
let allItems = [];
let focusMarker = null;
let focusCircle = null;

function setLanguage(lang) {
  currentLang = lang;
  const s = STRINGS[lang] || STRINGS.en;
  document.documentElement.lang = lang;

  $("brand").textContent = s.brand;
  $("title").textContent = s.title;
  $("subtitle").textContent = s.subtitle;
  $("ctaTop").textContent = s.cta;
  $("ctaBottom").textContent = s.cta;
  $("ctaMap").textContent = s.ctaMap;

  $("badge1").textContent = s.badges[0];
  $("badge2").textContent = s.badges[1];
  $("badge3").textContent = s.badges[2];

  $("sampleBtnEn").textContent = s.sampleBtnEn;
  $("sampleBtnDe").textContent = s.sampleBtnDe;

  $("whatTitle").textContent = s.whatTitle;
  const ul = $("whatList");
  ul.innerHTML = "";
  for (const item of s.what) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  }

  $("mapTitle").textContent = s.mapTitle;
  $("mapHint").textContent = s.mapHint;
  $("pointCountLabel").textContent = s.countLabel;
  $("mapQuery").placeholder = s.mapSearchPlaceholder;
  $("mapSearchBtn").textContent = s.mapSearchBtn;
  $("mapShowAllBtn").textContent = s.mapShowAllBtn;

  $("pricingTitle").textContent = s.pricingTitle;
  $("pricePilotName").textContent = s.pricePilotName;
  $("pricePilotValue").textContent = s.pricePilotValue;
  $("pricePilotDesc").textContent = s.pricePilotDesc;
  $("priceOngoingName").textContent = s.priceOngoingName;
  $("priceOngoingValue").textContent = s.priceOngoingValue;
  $("priceOngoingDesc").textContent = s.priceOngoingDesc;
  $("pricingCta").textContent = s.pricingCta;

  $("faqTitle").textContent = s.faqTitle;
  for (let i = 0; i < 3; i++) {
    $("faqQ" + (i + 1)).textContent = s.faq[i].q;
    $("faqA" + (i + 1)).textContent = s.faq[i].a;
  }

  $("formNote").textContent = s.formNote;
  $("formTitle").textContent = s.formTitle;
  $("labelClinic").textContent = s.form.clinic;
  $("labelWebsite").textContent = s.form.website;
  $("labelArea").textContent = s.form.area;
  $("labelEmail").textContent = s.form.email;
  $("labelNotes").textContent = s.form.notes;
  $("submitBtn").textContent = s.form.send;

  $("legal").textContent = s.legal;

  // buttons
  for (const b of document.querySelectorAll(".lang button")) {
    b.classList.toggle("active", b.dataset.lang === lang);
  }

  // Update status line if already loaded
  updateMapStatusAll();
}

function updateMapStatusAll() {
  const s = STRINGS[currentLang] || STRINGS.en;
  if (!$("mapStatus")) return;
  if (allItems.length) {
    $("mapStatus").textContent = s.mapStatusAll(allItems.length);
  }
}

async function loadPoints() {
  const resp = await fetch("assets/berlin_dentists_map.json", { cache: "no-cache" });
  const data = await resp.json();
  return data;
}

function initMap() {
  map = L.map("map", {
    scrollWheelZoom: false,
  }).setView([52.52, 13.405], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);

  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  });

  map.addLayer(cluster);

  // Enable scroll zoom after user interacts (prevents annoying page-scroll hijack)
  map.once("focus", () => map.scrollWheelZoom.enable());
  map.on("click", () => map.scrollWheelZoom.enable());
}

function popupHtml(item) {
  const name = escapeHtml(item.name);
  const address = item.address
    ? `<div style="margin-top:6px; color:#b7c3e6">${escapeHtml(item.address)}</div>`
    : "";

  const links = [];
  if (item.website) {
    links.push(
      `<a href="${escapeAttr(item.website)}" target="_blank" rel="noreferrer">Website</a>`
    );
  }
  if (item.gmaps) {
    links.push(
      `<a href="${escapeAttr(item.gmaps)}" target="_blank" rel="noreferrer">Google Maps</a>`
    );
  }

  const linksHtml = links.length
    ? `<div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap">${links.join(" ")}</div>`
    : "";

  return `<div style="min-width:220px">
    <div style="font-weight:700">${name}</div>
    ${address}
    ${linksHtml}
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  return escapeHtml(s);
}

function clearFocus() {
  if (focusMarker) {
    map.removeLayer(focusMarker);
    focusMarker = null;
  }
  if (focusCircle) {
    map.removeLayer(focusCircle);
    focusCircle = null;
  }
}

function renderItems(items) {
  cluster.clearLayers();

  for (const it of items) {
    const m = L.marker([it.lat, it.lon]);
    m.bindPopup(popupHtml(it), { maxWidth: 340 });
    cluster.addLayer(m);
  }

  $("pointCount").textContent = `${items.length}`;

  if (items.length > 0) {
    const bounds = L.latLngBounds(items.map((x) => [x.lat, x.lon]));
    map.fitBounds(bounds.pad(0.10));
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestItems(items, lat, lon, k = 15) {
  const scored = items
    .map((it) => ({ it, d: haversineKm(lat, lon, it.lat, it.lon) }))
    .sort((a, b) => a.d - b.d);
  return scored.slice(0, k).map((x) => x.it);
}

async function geocodeBerlin(query) {
  // Bias to Berlin using viewbox + bounded
  // viewbox = left,top,right,bottom
  const viewbox = "13.0884,52.6755,13.7612,52.3383";
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      format: "json",
      limit: "1",
      q: query,
      bounded: "1",
      viewbox,
    }).toString();

  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await resp.json();
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function renderAll() {
  clearFocus();
  renderItems(allItems);
  const s = STRINGS[currentLang] || STRINGS.en;
  $("mapStatus").textContent = s.mapStatusAll(allItems.length);
}

async function renderNearestTo(query) {
  const s = STRINGS[currentLang] || STRINGS.en;

  const geo = await geocodeBerlin(query);
  if (!geo) {
    $("mapStatus").textContent = s.mapStatusError;
    return;
  }

  const items = nearestItems(allItems, geo.lat, geo.lon, 15);

  clearFocus();
  focusMarker = L.circleMarker([geo.lat, geo.lon], {
    radius: 8,
    color: "#2dd4bf",
    weight: 2,
    fillColor: "#2dd4bf",
    fillOpacity: 0.35,
  }).addTo(map);

  // Circle radius roughly covering the selected competitors (distance to farthest)
  let maxKm = 0;
  for (const it of items) {
    maxKm = Math.max(maxKm, haversineKm(geo.lat, geo.lon, it.lat, it.lon));
  }
  const radiusMeters = Math.max(1200, maxKm * 1000);
  focusCircle = L.circle([geo.lat, geo.lon], {
    radius: radiusMeters,
    color: "rgba(124,92,255,0.85)",
    weight: 2,
    fillColor: "rgba(124,92,255,0.25)",
    fillOpacity: 0.15,
  }).addTo(map);

  renderItems(items);
  $("mapStatus").textContent = s.mapStatusNearest(items.length, query);
}

async function renderInitial() {
  const data = await loadPoints();
  allItems = data.items || [];
  await renderAll();
}

function wireLang() {
  for (const b of document.querySelectorAll(".lang button")) {
    b.addEventListener("click", () => setLanguage(b.dataset.lang));
  }
}

function wireCTAs() {
  // Smooth-scroll to form + prefill message when CTAs are clicked
  for (const id of ["ctaTop", "ctaBottom", "pricingCta"]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const formCard = $("form");
      if (formCard) formCard.scrollIntoView({ behavior: "smooth", block: "center" });

      // Prefill notes section so users can just hit submit
      const notesField = $("notes");
      const s = STRINGS[currentLang] || STRINGS.en;
      if (notesField && !notesField.value) {
        notesField.value = s.ctaPrefill;
      }

      // Focus first field for convenience
      const first = $("clinic");
      if (first) first.focus();
    });
  }
}

function wireMapSearch() {
  const form = $("mapSearchForm");
  const input = $("mapQuery");
  const showAllBtn = $("mapShowAllBtn");
  if (!form || !input || !showAllBtn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (input.value || "").trim();
    if (!q) return;
    $("mapStatus").textContent = "…";
    await renderNearestTo(q);
  });

  showAllBtn.addEventListener("click", async () => {
    await renderAll();
  });
}

async function postToFormspree(endpoint, payload) {
  // Send as form-encoded (FormData) — more compatible with Formspree endpoints
  const form = new FormData();
  for (const k of Object.keys(payload)) form.append(k, payload[k]);
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" },
    });
    return resp.ok;
  } catch (err) {
    return false;
  }
}

function wireForm() {
  const form = $("leadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const s = STRINGS[currentLang] || STRINGS.en;

    const payload = {
      clinic: $("clinic").value,
      website: $("website").value,
      area: $("area").value,
      email: $("email").value,
      notes: $("notes").value,
      lang: currentLang,
      ts: new Date().toISOString(),
    };

    const endpoint = form.dataset.formEndpoint || "";

    // 1) Prefer Formspree if configured
    if (endpoint) {
      const ok = await postToFormspree(endpoint, payload);
      if (ok) {
        // show modal confirmation
        showConfirmation(s.formAlert);
        form.reset();
        return;
      }
    }

    // 2) Fallback: mailto (no setup needed)
    const to = form.dataset.mailto || "";
    const subject = encodeURIComponent("Sample report request — DentalMarketPulse");
    const body = encodeURIComponent(
      [
        `Clinic: ${payload.clinic}`,
        `Website: ${payload.website}`,
        `Area: ${payload.area}`,
        `Email: ${payload.email}`,
        `Notes: ${payload.notes}`,
      ].join("\n")
    );

    if (to) {
      // localized mailto fallback message
      const fallbackMsg = currentLang === 'de'
        ? 'Kein direkter Server erreichbar — es öffnet sich Ihr E‑Mail-Client.'
        : "No direct server reachable — your mail client will open.";
      showConfirmation(fallbackMsg);
      setTimeout(() => {
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      }, 700);
    } else {
      showConfirmation(s.formAlert);
    }
  });
}

function showConfirmation(message) {
  const modal = $("confirmModal");
  if (!modal) return;
  $("modalTitle").textContent = message;
  $("modalBody").textContent = "Wir melden uns in Kürze per E‑Mail mit einem Beispielreport.";
  modal.setAttribute("aria-hidden", "false");

  const close = $("modalClose");
  const ok = $("modalOk");
  function hide() {
    modal.setAttribute("aria-hidden", "true");
    close.removeEventListener("click", hide);
    ok.removeEventListener("click", hide);
  }
  close.addEventListener("click", hide);
  ok.addEventListener("click", hide);
}

window.addEventListener("DOMContentLoaded", async () => {
  wireLang();
  wireCTAs();
  wireMapSearch();
  wireForm();
  setLanguage("de");
  initMap();
  await renderInitial();
});
