import React, { useEffect, useMemo, useRef, useState } from "react"; // add useRef
import { MapContainer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Geoguessr Trainer — Map Click Version (GeoJSON)
 * Screen-fit layout + simplified map (no basemap tiles)
 * --------------------------------------------------
 * - Cards (3 clues) and the map are visible together without scrolling on desktop.
 * - Map shows only country polygons (no lakes/streets) — i.e., no TileLayer.
 * - Hover highlights only the country outline (stroke), not a big tooltip box.
 *
 * Files to provide:
 *   public/data/data.json     // your countries & items (see earlier template)
 *   public/data/world.json    // GeoJSON FeatureCollection of countries
 */

const GEOJSON_PATH = "/data/world.json"; // place your world geojson here
const COUNTRY_PROP = "name"; // change to "ADMIN" if your geojson uses that

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCountries(data) {
  return (data || []).map((d) => d.country);
}

function validItems(items) {
  return (items || []).filter((it) => Array.isArray(it.images) && it.images.length > 0);
}

// --- Country name normalization & aliases ---
const ALIASES = new Map(Object.entries({
  "united states of america": "united states",
  "usa": "united states",
  "us": "united states",
  "russian federation": "russia",
  "republic of korea": "south korea",
  "korea, republic of": "south korea",
  "korea (republic of)": "south korea",
  "korea, democratic people's republic of": "north korea",
  "democratic people's republic of korea": "north korea",
  "syrian arab republic": "syria",
  "czech republic": "czechia",
  "swaziland": "eswatini",
  "cabo verde": "cape verde",
  "myanmar": "burma",
  "ivory coast": "cote d'ivoire",
  "côte d’ivoire": "cote d'ivoire",
  "lao people's democratic republic": "laos",
  "plurinational state of bolivia": "bolivia",
  "islamic republic of iran": "iran",
  "united republic of tanzania": "tanzania",
  "republic of moldova": "moldova",
  "macedonia": "north macedonia",
  "bosnia & herzegovina": "bosnia and herzegovina"
}));

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCountryName(name) {
  if (!name) return "";
  let s = String(name).trim().toLowerCase();
  s = stripDiacritics(s)
    .replace(/\s+/g, " ")
    .replace(/[^a-z'\s-]/g, "");
  if (ALIASES.has(s)) s = ALIASES.get(s);
  return s;
}

function pickQuestion(dataset, excludeCountry = null, usedImagesByCountry = new Map()) {
  const candidates = (dataset || []).filter((entry) => validItems(entry.items).length >= 3);
  if (!candidates.length) return null;

  // Prefer a different country than the previous one (when possible)
  let pool = candidates;
  if (excludeCountry && candidates.length > 1) {
    pool = candidates.filter(
      (c) => normalizeCountryName(c.country) !== normalizeCountryName(excludeCountry)
    );
    if (!pool.length) pool = candidates; // fallback
  }

  const correct = pool[Math.floor(Math.random() * pool.length)];

  // Pick 3 DISTINCT item types, then one random image from each (without repeating until all used)
  const itemPool = shuffleArray(validItems(correct.items));
  const chosenItems = itemPool.slice(0, 3);

  const usedForCountry = usedImagesByCountry.get(correct.country) || new Set();
  const images = chosenItems.map((it) => {
    const imgs = shuffleArray(it.images);
    let choice = imgs.find((u) => !usedForCountry.has(`${it.type}|${u}`));
    if (!choice) {
      for (const u of it.images) usedForCountry.delete(`${it.type}|${u}`); // reset cycle for this item type
      choice = imgs[0];
    }
    usedForCountry.add(`${it.type}|${choice}`);
    return { url: choice, type: it.type };
  });
  usedImagesByCountry.set(correct.country, usedForCountry);

  return { correctCountry: correct.country, images };
}

export default function GeoguessrFlashcards() {
  const [data, setData] = useState(null); // loaded dataset
  const [worldGeo, setWorldGeo] = useState(null); // loaded geojson
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null); // string | null (clicked country name)
  const [isCorrect, setIsCorrect] = useState(null); // boolean | null
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [usedImagesByCountry] = useState(() => new Map());


  // Load dataset + world geojson on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [dataRes, geoRes] = await Promise.all([
          fetch("/data/data.json", { cache: "no-store" }),
          fetch(GEOJSON_PATH, { cache: "no-store" }),
        ]);
        if (!dataRes.ok) throw new Error(`Failed data.json: ${dataRes.status}`);
        if (!geoRes.ok) throw new Error(`Failed world.json: ${geoRes.status}`);
        const [dataJson, geoJson] = await Promise.all([dataRes.json(), geoRes.json()]);
        if (!alive) return;
        setData(dataJson);
        setWorldGeo(geoJson);
        const q = pickQuestion(dataJson, null, usedImagesByCountry);
        setQuestion(q);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const questionRef = useRef(null);
  useEffect(() => { questionRef.current = question; }, [question]);

  const handleCountryClick = (countryName) => {
    const q = questionRef.current;
    if (selected || !q) return;

    setSelected(countryName);

    // (optional) normalizeCountryName(...) if you added normalization
    const correct = countryName === q.correctCountry;
    setIsCorrect(correct);
    setAnswered((n) => n + 1);
    if (correct) setScore((s) => s + 1);
  };

  const nextQuestion = () => {
    if (!data) return;
    const prev = question?.correctCountry || null;
    const q = pickQuestion(data, prev, usedImagesByCountry);
    setQuestion(q);
    setSelected(null);
    setIsCorrect(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full grid place-items-center bg-gray-50 text-gray-900">
        <div className="text-sm text-gray-600">Loading dataset & map…</div>
      </div>
    );
  }

  if (error || !question || !worldGeo) {
    return (
      <div className="h-screen w-full grid place-items-center bg-gray-50 text-gray-900 p-6">
        <div className="max-w-lg text-center">
          <h2 className="text-xl font-semibold mb-2">Problem loading resources</h2>
          <p className="text-gray-600 mb-4">{error || "No valid question could be generated or world.json missing."}</p>
          <button onClick={nextQuestion} className="px-4 py-2 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400">Try Again</button>
        </div>
      </div>
    );
  }

  // --- Map styling helpers ---
  const BASE_STROKE = "#111827"; // gray-900
  const HOVER_STROKE = "#2563EB"; // blue-600
  const CORRECT_FILL = "#10B981"; // emerald-500
  const CORRECT_STROKE = "#065F46"; // emerald-900
  const WRONG_FILL = "#EF4444"; // red-500
  const WRONG_STROKE = "#991B1B"; // red-900

  // Style for each country polygon based on selection state
  const getFeatureStyle = (feature) => {
    const name = feature?.properties?.[COUNTRY_PROP];
    const isSelected =
      normalizeCountryName(name) === normalizeCountryName(selected);
    const isCorrectCountry =
      normalizeCountryName(name) === normalizeCountryName(question.correctCountry)
    const base = { weight: 1, color: BASE_STROKE, fillColor: "#9CA3AF", fillOpacity: 0.15 };
    if (!selected) return base;

    if (isSelected) {
      return {
        ...base,
        fillColor: isCorrect ? CORRECT_FILL : WRONG_FILL,
        fillOpacity: 0.5,
        color: isCorrect ? CORRECT_STROKE : WRONG_STROKE,
        weight: 2,
      };
    }

    if (!isCorrect && isCorrectCountry) {
      return { ...base, fillColor: CORRECT_FILL, fillOpacity: 0.35, color: CORRECT_STROKE, weight: 2, dashArray: "3" };
    }

    return base;
  };

  const onEachCountry = (feature, layer) => {
    const name = feature?.properties?.[COUNTRY_PROP];
    if (!name) return;

    // no tooltip — highlight outline only on hover
    layer.on({
      click: () => handleCountryClick(name),
      mouseover: (e) => {
        if (!selected) {
          e.target.setStyle({ weight: 2, color: HOVER_STROKE });
        }
      },
      mouseout: (e) => {
        if (!selected) {
          e.target.setStyle({ weight: 1, color: BASE_STROKE });
        }
      },
    });
  };

  return (
    <div className="h-screen w-full bg-gray-50 text-gray-900 overflow-hidden">
      <div className="mx-auto max-w-7xl h-full p-4 md:p-6 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Geoguessr Trainer</h1>
            <p className="text-xs sm:text-sm text-gray-600">Pick the correct country on the map based on three visual clues.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm border">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Score</span>
              <div className="text-base font-semibold text-right">{score}</div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm border">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Answered</span>
              <div className="text-base font-semibold text-right">{answered}</div>
            </div>
          </div>
        </header>

        {/* Main content: two columns on md+; single column on mobile */}
        <div className="grid grid-rows-[auto,1fr] md:grid-rows-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Left: Clue cards */}
          <div className="rounded-2xl bg-white shadow-sm border p-3 md:p-4 flex flex-col h-full">
            {/* Scrollable image column so controls stay visible */}
            <div className="grid grid-cols-1 gap-3 flex-1 overflow-auto pr-1">
              {question.images.map((img, idx) => (
                <div key={idx} className="relative h-40 md:h-44 lg:h-48 overflow-hidden rounded-xl border bg-gray-100">
                  <img
                    src={img.url}
                    alt={`Clue ${idx + 1} — ${img.type}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1">
                    {img.type.replaceAll("_", " ")}
                  </div>
                </div>
              ))}
            </div>

            {/* Feedback + Controls (sticky at bottom of card) */}
            <div className="mt-3 sticky bottom-0 bg-white pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:justify-between">
                <div className="min-h-[1.25rem] text-sm">
                  {selected && (
                    <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                      {isCorrect ? "Correct!" : "Not quite."} The answer is <strong>{question.correctCountry}</strong>.
                    </span>
                  )}
                </div>

                <button
                  onClick={nextQuestion}
                  className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Next Question
                </button>
              </div>
            </div>
          </div>

          {/* Right: Map only polygons, no basemap */}
          <div className="rounded-2xl bg-white shadow-sm border overflow-hidden min-h-[300px]">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              className="h-full w-full"
              scrollWheelZoom={true}
              worldCopyJump={true}
              style={{ background: "transparent" }}
            >
              {/* No <TileLayer /> keeps the map clean (no lakes/roads). */}
              <GeoJSON data={worldGeo} style={getFeatureStyle} onEachFeature={onEachCountry} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
