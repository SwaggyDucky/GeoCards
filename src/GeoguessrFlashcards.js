import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { assetUrl } from "./utils";

import DeskSurface from "./components/DeskSurface";
import Corkboard from "./components/Corkboard";
import ParchmentMap from "./components/ParchmentMap";
import StatsEnvelope from "./components/StatsEnvelope";
import FilterDials from "./components/FilterDials";
import HelpBadge from "./components/HelpBadge";

/**
 * Geoguessr Trainer -- Map Click Version (GeoJSON)
 * Screen-fit layout + simplified map (no basemap tiles)
 * --------------------------------------------------
 * - Cards (3 clues) and the map are visible together without scrolling on desktop.
 * - Map shows only country polygons (no lakes/streets) -- i.e., no TileLayer.
 * - Hover highlights only the country outline (stroke), not a big tooltip box.
 *
 * Files to provide:
 *   public/data/data.json     // your countries & items (see earlier template)
 *   public/data/world.json    // GeoJSON FeatureCollection of countries
 */
const DATA_PATH = assetUrl("data/data.json");
const GEOJSON_PATH = assetUrl("data/world.json");
const COUNTRY_PROP = "name";
const ALL_REGIONS = "All regions";
const ALL_CLUE_TYPES = "All clue types";
const COMPACT_VIEWPORT_QUERY = "(max-width: 768px)";
const isCompactViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;

// Map styling palette — parchment theme
const BASE_STROKE = "#5C4A32";   // ink-faded
const BASE_FILL = "#F2E8D5";     // parchment
const BASE_FILL_OPACITY = 0.7;
const HOVER_STROKE = "#C8A84E";   // brass
const HOVER_FILL_OPACITY = 0.85;
const CORRECT_FILL = "#2D5A3E";   // wax-green
const CORRECT_STROKE = "#1E4030";
const WRONG_FILL = "#8B2E1E";     // wax-red
const WRONG_STROKE = "#6B1E12";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validItems(items) {
  return (items || []).filter((it) => Array.isArray(it.images) && it.images.length > 0);
}

function getUniqueTypeItems(items) {
  const seen = new Set();
  const unique = [];
  items.forEach((item) => {
    const key = typeof item.type === "string" ? item.type.toLowerCase() : "";
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(item);
  });
  return unique;
}

function getImagesForType(items, itemType) {
  const target = itemType ? itemType.toLowerCase() : null;
  const images = [];
  items.forEach((item) => {
    if (typeof item.type !== "string") {
      return;
    }
    const itemKey = item.type.toLowerCase();
    if (!target || itemKey === target) {
      item.images.forEach((url) => {
        images.push({ url, type: item.type });
      });
    }
  });
  return images;
}

function buildQuestion(entry, options = {}) {
  const clueCount = options.clueCount ?? 3;
  const usableItems = validItems(entry.items);
  if (usableItems.length === 0) {
    return null;
  }

  if (options.itemType) {
    const imagesPool = getImagesForType(usableItems, options.itemType);
    if (imagesPool.length < clueCount) {
      return null;
    }
    return {
      correctCountry: entry.country,
      images: shuffleArray(imagesPool).slice(0, clueCount),
    };
  }

  const uniqueItems = getUniqueTypeItems(usableItems);
  if (uniqueItems.length < clueCount) {
    return null;
  }

  const chosenItems = shuffleArray(uniqueItems).slice(0, clueCount);
  const images = chosenItems.map((item) => {
    const img = item.images[Math.floor(Math.random() * item.images.length)];
    return { url: img, type: item.type };
  });

  return {
    correctCountry: entry.country,
    images,
  };
}

function pickQuestion(dataset, options = {}) {
  const clueCount = options.clueCount ?? 3;
  const candidates = (dataset || []).filter((entry) => {
    if (options.region && entry.region !== options.region) {
      return false;
    }
    const usableItems = validItems(entry.items);
    if (usableItems.length === 0) {
      return false;
    }

    if (options.itemType) {
      const imagesPool = getImagesForType(usableItems, options.itemType);
      return imagesPool.length >= clueCount;
    }

    const uniqueItems = getUniqueTypeItems(usableItems);
    return uniqueItems.length >= clueCount;
  });

  if (candidates.length === 0) {
    return null;
  }

  const correct = candidates[Math.floor(Math.random() * candidates.length)];
  return buildQuestion(correct, options);
}

function getRegions(dataset) {
  const regions = new Set();
  (dataset || []).forEach((entry) => {
    if (entry.region) {
      regions.add(entry.region);
    }
  });
  return Array.from(regions).sort((a, b) => a.localeCompare(b));
}

function getItemTypes(dataset) {
  const typeMap = new Map();
  (dataset || []).forEach((entry) => {
    (entry.items || []).forEach((item) => {
      if (!item || !item.type) return;
      const key = item.type.toLowerCase();
      if (!typeMap.has(key)) {
        typeMap.set(key, item.type);
      }
    });
  });
  return Array.from(typeMap.values()).sort((a, b) => a.localeCompare(b));
}

export default function GeoguessrFlashcards() {
  const [data, setData] = useState(null);
  const [worldGeo, setWorldGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [visibleClues, setVisibleClues] = useState(1);
  const [streak, setStreak] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState("");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableItemTypes, setAvailableItemTypes] = useState([]);
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeItemType, setActiveItemType] = useState(null);
  const [filterError, setFilterError] = useState(false);
  const initialCompact = useMemo(() => isCompactViewport(), []);
  const [isCompactLayout, setIsCompactLayout] = useState(initialCompact);
  const [isMapOpen, setIsMapOpen] = useState(!initialCompact);
  const [sealPosition, setSealPosition] = useState(null);
  const [blotPosition, setBlotPosition] = useState(null);

  const mapRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const worldBoundsRef = useRef(null);
  const geoJsonLayersRef = useRef({});

  const questionOptions = useMemo(
    () => ({
      region: activeRegion || undefined,
      itemType: activeItemType || undefined,
    }),
    [activeRegion, activeItemType]
  );

  const regionOptions = useMemo(() => [ALL_REGIONS, ...availableRegions], [availableRegions]);
  const itemTypeOptions = useMemo(() => [ALL_CLUE_TYPES, ...availableItemTypes], [availableItemTypes]);

  const rerollQuestion = useCallback(
    ({ resetStats = false } = {}) => {
      if (!data) return;
      const next = pickQuestion(data, questionOptions);
      if (!next) {
        setError(null);
        setQuestion(null);
        setFilterError(true);
        setSelected(null);
        setIsCorrect(null);
        setVisibleClues(0);
        setSealPosition(null);
        setBlotPosition(null);
        if (resetStats) {
          setScore(0);
          setAnswered(0);
          setStreak(0);
        }
        return;
      }

      setError(null);
      setFilterError(false);
      setQuestion(next);
      setSelected(null);
      setIsCorrect(null);
      setVisibleClues(1);
      setSealPosition(null);
      setBlotPosition(null);
      if (resetStats) {
        setScore(0);
        setAnswered(0);
        setStreak(0);
      }
    },
    [data, questionOptions]
  );

  const nextQuestion = rerollQuestion;

  const getCountryPixelPosition = useCallback((countryName) => {
    if (!mapRef.current || !countryName) return null;
    const layer = geoJsonLayersRef.current[countryName];
    if (!layer) return null;
    try {
      const center = layer.getBounds().getCenter();
      const point = mapRef.current.latLngToContainerPoint(center);
      return { x: point.x, y: point.y };
    } catch {
      return null;
    }
  }, []);

  // Keyboard shortcuts keep navigation quick.
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "enter") {
        nextQuestion();
      } else if (key === "h") {
        if (!question) return;
        setVisibleClues((n) => Math.min(question.images.length, n + 1));
      } else if (key === "r") {
        if (worldBoundsRef.current && mapRef.current) {
          mapRef.current.fitBounds(worldBoundsRef.current, { padding: [20, 20] });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextQuestion, question]);

  // Load dataset + world geojson on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [dataRes, geoRes] = await Promise.all([
          fetch(DATA_PATH, { cache: "no-store" }),
          fetch(GEOJSON_PATH, { cache: "no-store" }),
        ]);
        if (!dataRes.ok) throw new Error(`Failed data.json: ${dataRes.status}`);
        if (!geoRes.ok) throw new Error(`Failed world.json: ${geoRes.status}`);

        const [dataJson, geoJson] = await Promise.all([dataRes.json(), geoRes.json()]);
        if (!alive) return;

        setData(dataJson);
        setWorldGeo(geoJson);
        setAvailableRegions(getRegions(dataJson));
        setAvailableItemTypes(getItemTypes(dataJson));
        setFilterError(false);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    rerollQuestion({ resetStats: true });
  }, [data, rerollQuestion]);

  const clearFilters = useCallback(() => {
    setActiveRegion(null);
    setActiveItemType(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const media = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = (event) => {
      setIsCompactLayout(event.matches);
      setIsMapOpen(!event.matches);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleChange);
    }
    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleChange);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleChange);
      }
    };
  }, []);

  // Keep the map sized correctly when the layout changes.
  useEffect(() => {
    const invalidate = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };

    const ro = new ResizeObserver(invalidate);
    if (mapWrapperRef.current) ro.observe(mapWrapperRef.current);

    return () => ro.disconnect();
  }, [worldGeo]);

  useEffect(() => {
    if (!isMapOpen || !mapRef.current) return undefined;
    const timeout = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 180);
    return () => clearTimeout(timeout);
  }, [isMapOpen, question, visibleClues]);

  useEffect(() => {
    if (!worldGeo || !mapRef.current) return;
    try {
      const layer = L.geoJSON(worldGeo);
      const bounds = layer.getBounds();
      worldBoundsRef.current = bounds;
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    } catch (e) {
      console.warn("fitBounds failed:", e);
    }
  }, [worldGeo, isCompactLayout, isMapOpen]);

  const handleCountryClick = (countryName) => {
    if (selected || !question) return;
    setSelected(countryName);
    const correct = countryName === question.correctCountry;
    setIsCorrect(correct);
    setAnswered((n) => n + 1);
    if (correct) {
      setScore((s) => s + 1);
      setStreak((st) => st + 1);
    } else {
      setStreak(0);
    }
    setTimeout(() => {
      setSealPosition(getCountryPixelPosition(question.correctCountry));
      if (!correct) setBlotPosition(getCountryPixelPosition(countryName));
    }, 50);
  };

  const handleRevealClue = () => {
    if (question) {
      setVisibleClues((n) => Math.min(question.images.length, n + 1));
    }
  };

  // Map styling uses module-level constants defined above.

  const getFeatureStyle = (feature) => {
    const name = feature?.properties?.[COUNTRY_PROP];
    const base = {
      weight: 1.2,
      color: BASE_STROKE,
      fillColor: BASE_FILL,
      fillOpacity: BASE_FILL_OPACITY,
      opacity: 0.8,
    };

    if (!selected && name === hoveredCountry) {
      return {
        ...base,
        weight: 2.5,
        color: HOVER_STROKE,
        fillOpacity: HOVER_FILL_OPACITY,
      };
    }

    if (!selected) return base;

    if (name === selected) {
      return {
        ...base,
        fillColor: isCorrect ? CORRECT_FILL : WRONG_FILL,
        fillOpacity: 0.6,
        color: isCorrect ? CORRECT_STROKE : WRONG_STROKE,
        weight: 3,
        dashArray: "3",
      };
    }

    if (!isCorrect && question && name === question.correctCountry) {
      return {
        ...base,
        fillColor: CORRECT_FILL,
        fillOpacity: 0.35,
        color: CORRECT_STROKE,
        weight: 2.5,
        dashArray: "4 2",
      };
    }

    return base;
  };

  const onEachCountry = (feature, layer) => {
    const name = feature?.properties?.[COUNTRY_PROP];
    if (!name) return;

    geoJsonLayersRef.current[name] = layer;

    // no tooltip - highlight outline only on hover
    layer.on({
      click: () => handleCountryClick(name),
      mouseover: (e) => {
        if (!selected) {
          e.target.setStyle({ weight: 2, color: HOVER_STROKE, fillOpacity: HOVER_FILL_OPACITY });
        }
        setHoveredCountry(name);
      },
      mouseout: (e) => {
        if (!selected) {
          e.target.setStyle({ weight: 1.2, color: BASE_STROKE, fillOpacity: BASE_FILL_OPACITY });
        }
        setHoveredCountry("");
      },
    });
  };

  const hasQuestion = Boolean(question);
  const totalClues = hasQuestion ? question.images.length : 0;
  const cluesShown = hasQuestion ? Math.min(visibleClues, totalClues) : 0;
  const canRevealMore = hasQuestion && cluesShown < totalClues;
  const regionLabel = activeRegion || ALL_REGIONS;
  const itemTypeLabel = activeItemType || ALL_CLUE_TYPES;
  const clueImages = hasQuestion ? question.images.slice(0, cluesShown) : [];

  const statusMessage = (() => {
    if (hoveredCountry) return hoveredCountry;
    if (selected && hasQuestion) return isCorrect ? "Well navigated!" : `The correct port was ${question.correctCountry}`;
    return "Click a country to make your guess";
  })();

  /* Loading state */
  if (loading) {
    return (
      <DeskSurface>
        <div className="flex h-full items-center justify-center">
          <p className="animate-pulse font-fell text-xl tracking-wide text-parchment-dark">
            Unrolling the charts...
          </p>
        </div>
      </DeskSurface>
    );
  }

  /* Error state */
  if (error || !worldGeo) {
    return (
      <DeskSurface>
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="font-fell text-2xl text-parchment">Charts unavailable</h2>
          <p className="font-cormorant text-sm italic text-parchment-dark">{error || "The GeoJSON file could not be loaded."}</p>
          <button onClick={() => window.location.reload()} className="rounded border-2 border-brass bg-parchment px-5 py-2 font-fell text-sm text-ink shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-parchment-dark">
            Try Again
          </button>
        </div>
      </DeskSurface>
    );
  }

  /* Main layout */
  return (
    <DeskSurface>
      <div className="relative flex h-full w-full flex-col overflow-y-auto p-4 md:p-6 lg:overflow-hidden lg:p-8">
        {/* Header */}
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="animate-title-emboss font-fell text-2xl tracking-wide text-parchment md:text-3xl">
              The Cartographer's Desk
            </h1>
            <p className="mt-1 font-cormorant text-sm italic text-parchment-dark">
              Study the clues. Identify the country.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FilterDials
              regionOptions={regionOptions}
              itemTypeOptions={itemTypeOptions}
              regionLabel={regionLabel}
              itemTypeLabel={itemTypeLabel}
              onRegionChange={(v) => setActiveRegion(v === ALL_REGIONS ? null : v)}
              onItemTypeChange={(v) => setActiveItemType(v === ALL_CLUE_TYPES ? null : v)}
              isCompactLayout={isCompactLayout}
            />
          </div>
        </header>

        {/* Main content */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Left column */}
          <div className="flex w-full flex-shrink-0 flex-col gap-4 overflow-y-auto lg:w-[28%] lg:max-w-[340px]">
            <Corkboard
              clueImages={clueImages}
              totalClues={totalClues}
              cluesShown={cluesShown}
              canRevealMore={canRevealMore}
              onReveal={handleRevealClue}
              onNext={nextQuestion}
              selected={selected}
              isCorrect={isCorrect}
              correctCountry={question?.correctCountry}
              isCompactLayout={isCompactLayout}
            />

            {filterError && !hasQuestion && (
              <div className="rounded border border-dashed border-brass/50 bg-parchment/10 p-3 font-cormorant text-sm italic text-parchment">
                <p>No expeditions match these charts.</p>
                <button onClick={clearFilters} className="mt-2 text-brass underline">Clear filters</button>
              </div>
            )}

            <StatsEnvelope
              score={score}
              answered={answered}
              streak={streak}
              regionLabel={regionLabel}
              itemTypeLabel={itemTypeLabel}
            />
          </div>

          {/* Right column: map */}
          <div className="relative min-h-0 flex-1">
            {isCompactLayout && (
              <button
                onClick={() => setIsMapOpen((o) => !o)}
                aria-expanded={isMapOpen}
                className="mb-3 flex w-full items-center justify-between rounded border-2 border-brass bg-parchment/10 px-4 py-2.5 font-fell text-sm tracking-wide text-parchment shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-parchment/20"
              >
                <span>{isMapOpen ? "Fold the map" : "Unfold the map"}</span>
                <span className={`inline-block transition-transform ${isMapOpen ? "rotate-180" : ""}`}>
                  <svg className="h-4 w-4 text-parchment" viewBox="0 0 20 20" fill="none">
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            )}

            <ParchmentMap
              mapRef={mapRef}
              worldGeo={worldGeo}
              question={question}
              getFeatureStyle={getFeatureStyle}
              onEachCountry={onEachCountry}
              statusMessage={statusMessage}
              mapWrapperRef={mapWrapperRef}
              isCompactLayout={isCompactLayout}
              isMapOpen={isMapOpen}
              sealPosition={sealPosition}
              blotPosition={blotPosition}
              selected={selected}
              isCorrect={isCorrect}
            />
          </div>
        </div>

        {/* Help badge */}
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8">
          <HelpBadge />
        </div>
      </div>
    </DeskSurface>
  );
}
