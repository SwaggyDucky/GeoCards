import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
const BASE = process.env.PUBLIC_URL || "";
const assetUrl = (p) => `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
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

  const mapRef = useRef(null);
  const leftRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const worldBoundsRef = useRef(null);

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
      if (resetStats) {
        setScore(0);
        setAnswered(0);
        setStreak(0);
      }
    },
    [data, questionOptions]
  );

  const nextQuestion = useCallback(() => {
    rerollQuestion();
  }, [rerollQuestion]);

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
      setIsMapOpen(event.matches ? false : true);
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

  // Keep the map sized with the layout around it.
  useEffect(() => {
    if (!mapRef.current || !leftRef.current) return;

    const ro = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    ro.observe(leftRef.current);

    const onResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [worldGeo]);

  useEffect(() => {
    if (!mapRef.current || !mapWrapperRef.current) return;

    const ro = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    ro.observe(mapWrapperRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [question, visibleClues]);

  useEffect(() => {
    if (!isMapOpen || !mapRef.current) return undefined;
    const timeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [isMapOpen]);

  useEffect(() => {
    if (isCompactLayout && !isMapOpen) {
      mapRef.current = null;
    }
  }, [isCompactLayout, isMapOpen]);

  useEffect(() => {
    if (!worldGeo || !mapRef.current) return;
    try {
      const layer = L.geoJSON(worldGeo);
      const bounds = layer.getBounds();
      worldBoundsRef.current = bounds;
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    } catch (_) {
      // ignore
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
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100">
        <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="h-8 w-48 rounded-full bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-20 rounded-2xl bg-white/10" />
              <div className="h-12 w-24 rounded-2xl bg-white/10" />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,360px),1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/10 shadow-[0_24px_60px_-15px_rgba(2,6,23,0.9)]" />
            <div className="rounded-3xl border border-white/10 bg-white/10 shadow-[0_35px_80px_-20px_rgba(0,8,20,0.9)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100">
        <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-3xl font-bold text-white">Problem loading resources</h2>
          <p className="text-sm text-slate-200/80">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!worldGeo) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100">
        <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-3xl font-bold text-white">World map unavailable</h2>
          <p className="text-sm text-slate-200/80">The GeoJSON file could not be loaded.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  // Map styling helpers keep the palette consistent.
  const BASE_STROKE = "#E0F2FE";
  const BASE_FILL = "#38BDF8";
  const BASE_FILL_OPACITY = 0.18;
  const HOVER_STROKE = "#60A5FA";
  const HOVER_FILL_OPACITY = 0.35;
  const CORRECT_FILL = "#22C55E";
  const CORRECT_STROKE = "#15803D";
  const WRONG_FILL = "#F87171";
  const WRONG_STROKE = "#B91C1C";

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

  const handleZoom = (direction) => {
    if (!mapRef.current) return;
    if (direction === "in") {
      mapRef.current.zoomIn();
    } else {
      mapRef.current.zoomOut();
    }
  };

  const hasQuestion = Boolean(question);
  const totalClues = hasQuestion ? question.images.length : 0;
  const cluesShown = hasQuestion ? Math.min(visibleClues, totalClues) : 0;


  const canRevealMore = hasQuestion && cluesShown < totalClues;
  const regionLabel = activeRegion || ALL_REGIONS;
  const itemTypeLabel = activeItemType || ALL_CLUE_TYPES;
  const showFilterMessage = !hasQuestion && filterError;
  const showClueSkeleton = !hasQuestion && !filterError;
  const clueImages = hasQuestion ? question.images.slice(0, cluesShown) : [];
  const statusMessage = (() => {
    if (hoveredCountry) {
      return `Hovering: ${hoveredCountry}`;
    }
    if (selected) {
      if (hasQuestion) {
        return isCorrect ? "You nailed it!" : `Answer: ${question.correctCountry}`;
      }
      return "No active question";
    }
    return "Hover and click a country to guess";
  })();
  const clueListLayout = isCompactLayout ? "grid grid-cols-3 gap-3" : "flex flex-col gap-4";
  const mapPanelClasses = [
    "relative min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-[0_35px_80px_-20px_rgba(0,8,20,0.9)] transition-[max-height,height,opacity,transform] duration-300 ease-out",
    isCompactLayout
      ? isMapOpen
        ? "h-[60vh] max-h-[75vh] min-h-[360px] opacity-100 pointer-events-auto translate-y-0"
        : "max-h-0 h-0 opacity-0 pointer-events-none -translate-y-2"
      : "h-[420px] xl:h-[78vh] opacity-100 pointer-events-auto",
  ].join(" ");
  const mapToggleLabel = isMapOpen ? "Hide map" : "Show map";
  const mapPanelId = "geo-training-map-panel";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100 overflow-hidden">
      <div className="relative mx-auto flex h-full w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-32 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>

        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:mt-2 sm:text-4xl">
              Geoguessr Trainer
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-200/80">
              Use the visual clues to lock on to the right country. Drag, zoom, and click the map to answer.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Region</label>
                <select
                  className="mt-1 rounded-xl border border-white/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-sky-300/60 focus:ring-2 focus:ring-sky-200/70 disabled:cursor-not-allowed disabled:opacity-60"
                  value={regionLabel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveRegion(value === ALL_REGIONS ? null : value);
                  }}
                  disabled={regionOptions.length <= 1}
                >
                  {regionOptions.map((region) => (
                    <option key={region} value={region} className="bg-slate-900 text-slate-100">
                      {region}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Clue Type</label>
                <select
                  className="mt-1 rounded-xl border border-white/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-sky-300/60 focus:ring-2 focus:ring-sky-200/70 disabled:cursor-not-allowed disabled:opacity-60"
                  value={itemTypeLabel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveItemType(value === ALL_CLUE_TYPES ? null : value);
                  }}
                  disabled={itemTypeOptions.length <= 1}
                >
                  {itemTypeOptions.map((type) => (
                    <option key={type} value={type} className="bg-slate-900 text-slate-100">
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Score</span>
              <span className="text-xl font-bold text-white">{score}</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Answered</span>
              <span className="text-xl font-bold text-white">{answered}</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Streak</span>
              <span className="text-xl font-bold text-white">{streak}</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Accuracy</span>
              <span className="text-xl font-bold text-white">{answered ? Math.round((score / answered) * 100) : 0}%</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Active Region</span>
              <span className="text-sm font-semibold text-white">{regionLabel}</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/70">Clue Filter</span>
              <span className="text-sm font-semibold text-white">{itemTypeLabel}</span>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,340px),minmax(0,1fr)]">
          <div
            ref={leftRef}
            className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-[0_24px_60px_-15px_rgba(2,6,23,0.9)] backdrop-blur xl:h-[78vh] xl:max-h-[78vh]"
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100/80">Clue Summary</p>
                <h2 className="text-lg font-bold text-white">Visual Reference</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                {hasQuestion ? `${cluesShown}/${totalClues}` : "-"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
              <div className={clueListLayout}>
                {clueImages.map((img, idx) => (
                  <div
                    key={`${img.url}-${idx}`}
                    className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-lg aspect-[3/4] sm:aspect-[4/3]"
                  >
                    <img
                      src={`${process.env.PUBLIC_URL}${img.url}`}
                      alt={`Clue ${idx + 1} - ${img.type}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>

              {showClueSkeleton && (
                <div className="mt-4 space-y-4">
                  <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-900/40" />
                  <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-900/30" />
                </div>
              )}

              {showFilterMessage && (
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-sky-400/60 bg-sky-500/10 px-4 py-4 text-sm text-sky-100/90">
                  <p className="font-semibold">No questions match these filters yet.</p>
                  <p className="text-xs text-slate-200/80">
                    Try another region or clue type to keep the training going.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={clearFilters}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      Clear filters
                    </button>
                    <button
                      onClick={nextQuestion}
                      className="rounded-xl border border-sky-300/40 bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {canRevealMore && (
                <button
                  onClick={() => {
                    if (question) {
                      setVisibleClues((n) => Math.min(question.images.length, n + 1));
                    }
                  }}
                  className="mt-4 w-full rounded-2xl border border-dashed border-sky-400/60 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  Reveal another clue
                </button>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/50 px-5 py-4 backdrop-blur">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <div className="min-h-[1.25rem] text-sm text-slate-200/90">
                  {selected && hasQuestion && (
                    <span className={isCorrect ? "text-emerald-300" : "text-rose-300"}>
                      {isCorrect ? "Correct!" : "Not quite."} The answer is <strong>{question.correctCountry}</strong>.
                    </span>
                  )}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button
                    onClick={() => {
                      if (question) {
                        setVisibleClues((n) => Math.min(question.images.length, n + 1));
                      }
                    }}
                    disabled={!canRevealMore}
                    className="hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
                  >
                    Reveal
                  </button>
                  <button
                    onClick={nextQuestion}
                    className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-auto"
                  >
                    Next Question
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:gap-4">
            {isCompactLayout && (
              <button
                type="button"
                onClick={() => setIsMapOpen((open) => !open)}
                aria-expanded={isMapOpen}
                aria-controls={mapPanelId}
                className="flex items-center justify-between rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-left text-sm font-semibold text-slate-100 shadow-lg transition hover:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <span className="flex flex-col text-left">
                  <span>{mapToggleLabel}</span>
                  <span className="text-xs font-normal text-slate-300">
                    {isMapOpen ? "Hide the map until you're ready to guess." : "Open the map when you're ready to pick a country."}
                  </span>
                </span>
                <span
                  className={`ml-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 transition-transform ${
                    isMapOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4 text-slate-100"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            )}

            <div
              id={mapPanelId}
              ref={mapWrapperRef}
              className={mapPanelClasses}
              aria-hidden={isCompactLayout && !isMapOpen}
            >
              {(!isCompactLayout || isMapOpen) && (
                <>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%)]" />

                  <div className="absolute left-6 right-6 top-6 z-[400] flex flex-col gap-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs uppercase tracking-wide text-slate-100/80 shadow-lg backdrop-blur">
                      {statusMessage}
                    </div>
                  </div>

                  <MapContainer
                    whenCreated={(map) => {
                      mapRef.current = map;
                    }}
                    center={[20, 0]}
                    zoom={2}
                    minZoom={1}
                    zoomControl={false}
                    attributionControl={false}
                    className="h-full w-full"
                    scrollWheelZoom={true}
                    style={{ background: "radial-gradient(circle at top, #0f172a 0%, #020617 75%)" }}
                  >
                    <GeoJSON key={question?.correctCountry || "init"} data={worldGeo} style={getFeatureStyle} onEachFeature={onEachCountry} />
                  </MapContainer>
                </>
              )}
            </div>
          </div>
        </div>
    </div>
  </div>
  );
}
