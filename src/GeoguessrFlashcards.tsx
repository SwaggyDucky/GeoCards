import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, GeoJSON as GeoJSONLayer, useMap } from "react-leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import L, { type Map as LeafletMap, type PathOptions, type Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZodError } from "zod";
import type { CountryEntry, Question } from "./types";
import { getItemTypes, getRegions, pickQuestion, type QuestionOptions, validateDataset } from "./lib/questions";

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
const COUNTRY_PROP = "name";
const BASE = process.env.PUBLIC_URL || "";
const assetUrl = (p: string): string => `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
const DATA_PATH = assetUrl("data/data.json");
const GEOJSON_PATH = assetUrl("data/world.json");
const ALL_REGIONS = "All regions";
const ALL_CLUE_TYPES = "All clue types";

function MapInstanceSetter({ onMapReady }: { onMapReady: (map: LeafletMap) => void }) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

export default function GeoguessrFlashcards() {
  const [data, setData] = useState<CountryEntry[] | null>(null);
  const [worldGeo, setWorldGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [visibleClues, setVisibleClues] = useState(1);
  const [streak, setStreak] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState("");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableItemTypes, setAvailableItemTypes] = useState<string[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<string | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const worldBoundsRef = useRef<L.LatLngBounds | null>(null);
  const isMountedRef = useRef(true);

  const questionOptions = useMemo<QuestionOptions>(() => {
    return {
      region: activeRegion ?? undefined,
      itemType: activeItemType ?? undefined,
    };
  }, [activeRegion, activeItemType]);

  const regionOptions = useMemo(() => [ALL_REGIONS, ...availableRegions], [availableRegions]);
  const itemTypeOptions = useMemo(() => [ALL_CLUE_TYPES, ...availableItemTypes], [availableItemTypes]);

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const nextQuestion = useCallback(() => {
    if (!data) return;

    setSelected(null);
    setIsCorrect(null);
    setVisibleClues(1);

    const fallback = pickQuestion(data, questionOptions);
    if (!fallback) {
      setError("No questions available for the current filters. Please adjust and try again.");
      setQuestion(null);
      return;
    }

    setQuestion(fallback);
    setError(null);
  }, [data, questionOptions]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [dataRes, geoRes] = await Promise.all([
        fetch(DATA_PATH, { cache: "no-store" }),
        fetch(GEOJSON_PATH, { cache: "no-store" }),
      ]);

      if (!dataRes.ok) {
        throw new Error(`Failed to load data.json (${dataRes.status})`);
      }
      if (!geoRes.ok) {
        throw new Error(`Failed to load world.json (${geoRes.status})`);
      }

      const rawData = await dataRes.json();
      const countries = validateDataset(rawData);
      const world = (await geoRes.json()) as FeatureCollection<Geometry>;

      if (!isMountedRef.current) return;

      setData(countries);
      setWorldGeo(world);
      setAvailableRegions(getRegions(countries));
      setAvailableItemTypes(getItemTypes(countries));

      const filters: QuestionOptions = {
        region: activeRegion ?? undefined,
        itemType: activeItemType ?? undefined,
      };

      const initialQuestion = pickQuestion(countries, filters);
      if (!initialQuestion) {
        setError("Dataset does not contain enough clues for the current filters.");
        setQuestion(null);
      } else {
        setQuestion(initialQuestion);
        setError(null);
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      const message =
        e instanceof ZodError
          ? `Invalid dataset: ${e.issues.map((issue) => issue.message).join(", ")}`
          : e instanceof Error
          ? e.message
          : "Unknown error";
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeRegion, activeItemType]);
  // Keyboard shortcuts keep navigation quick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "enter") {
        nextQuestion();
      } else if (key === "h") {
        setVisibleClues((n) => Math.min(question?.images?.length || 3, n + 1));
      } else if (key === "r") {
        if (worldBoundsRef.current && mapRef.current) {
          mapRef.current.fitBounds(worldBoundsRef.current, { padding: [20, 20] });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, nextQuestion]);

  // Load dataset + world geojson on mount.
  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

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
    if (!worldGeo || !mapRef.current) return;
    try {
      const layer = L.geoJSON(worldGeo);
      const bounds = layer.getBounds();
      worldBoundsRef.current = bounds;
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    } catch (_) {
      // ignore
    }
  }, [worldGeo]);

  const handleCountryClick = (countryName: string) => {
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

  if (error || !question || !worldGeo) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100">
        <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-3xl font-bold text-white">Problem loading resources</h2>
          <p className="text-sm text-slate-200/80">
            {error || "No valid question could be generated or world.json is missing."}
          </p>
          <button
            onClick={() => {
              void loadInitialData();
            }}
            className="rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            Try Again
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

  const getFeatureStyle = (feature?: Feature<Geometry, Record<string, unknown>>): PathOptions => {
    const properties = (feature?.properties ?? {}) as Record<string, unknown>;
    const name = typeof properties[COUNTRY_PROP] === "string" ? (properties[COUNTRY_PROP] as string) : undefined;

    const base: PathOptions = {
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

    if (!isCorrect && name === question.correctCountry) {
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

  const onEachCountry = (feature: Feature<Geometry, Record<string, unknown>>, layer: Layer) => {
    const properties = (feature?.properties ?? {}) as Record<string, unknown>;
    const name = typeof properties[COUNTRY_PROP] === "string" ? (properties[COUNTRY_PROP] as string) : null;
    if (!name) return;

    // no tooltip - highlight outline only on hover
    const pathLayer = layer as L.Path;
    pathLayer.on({
      click: () => handleCountryClick(name),
      mouseover: (e: L.LeafletMouseEvent) => {
        if (!selected) {
          (e.target as L.Path).setStyle({ weight: 2, color: HOVER_STROKE, fillOpacity: HOVER_FILL_OPACITY });
        }
        setHoveredCountry(name);
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        if (!selected) {
          (e.target as L.Path).setStyle({ weight: 1.2, color: BASE_STROKE, fillOpacity: BASE_FILL_OPACITY });
        }
        setHoveredCountry("");
      },
    });
  };

  const handleZoom = (direction: "in" | "out") => {
    if (!mapRef.current) return;
    if (direction === "in") {
      mapRef.current.zoomIn();
    } else {
      mapRef.current.zoomOut();
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 text-slate-100 overflow-hidden">
      <div className="relative mx-auto flex h-full w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-32 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>

        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-sky-100/80">
              Geo Deck
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Geoguessr Trainer
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-200/80">
              Use the visual clues to lock on to the right country. Drag, zoom, and click the map to answer.
            </p>
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
                {visibleClues}/{question.images.length}
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-3">
              {question.images.slice(0, visibleClues).map((img, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-lg"
                >
                  <img
                    src={`${process.env.PUBLIC_URL}${img.url}`}
                    alt={`Clue ${idx + 1} - ${img.type}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              ))}

              {visibleClues < question.images.length && (
                <button
                  onClick={() => setVisibleClues((n) => Math.min(question.images.length, n + 1))}
                  className="w-full rounded-2xl border border-dashed border-sky-400/60 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  Reveal another clue
                </button>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/50 px-5 py-4 backdrop-blur">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <div className="min-h-[1.25rem] text-sm text-slate-200/90">
                  {selected && (
                    <span className={isCorrect ? "text-emerald-300" : "text-rose-300"}>
                      {isCorrect ? "Correct!" : "Not quite."} The answer is <strong>{question.correctCountry}</strong>.
                    </span>
                  )}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button
                    onClick={() => setVisibleClues((n) => Math.min(question.images.length, n + 1))}
                    disabled={visibleClues >= question.images.length}
                    className="hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
                  >
                    Reveal
                  </button>
                  <button
                    onClick={() => {
                      nextQuestion();
                    }}
                    className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-auto"
                  >
                    Next Question
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={mapWrapperRef}
            className="relative h-[420px] min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-[0_35px_80px_-20px_rgba(0,8,20,0.9)] xl:h-[78vh]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%)]" />

            <div className="absolute left-6 right-6 top-6 z-[400] flex flex-col gap-3 pointer-events-none">
              <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs uppercase tracking-wide text-slate-100/80 shadow-lg backdrop-blur">
                <span>
                  {hoveredCountry
                    ? `Hovering: ${hoveredCountry}`
                    : selected
                    ? isCorrect
                      ? "You nailed it!"
                      : `Answer: ${question.correctCountry}`
                    : "Hover and click a country to guess"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleZoom("out")}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-base font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    title="Zoom out"
                  >
                    -
                  </button>
                  <button
                    onClick={() => handleZoom("in")}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-base font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    title="Zoom in"
                  >
                    +
                  </button>
                  <button
                    onClick={() => {
                      if (worldBoundsRef.current && mapRef.current) {
                        mapRef.current.fitBounds(worldBoundsRef.current, { padding: [20, 20] });
                      }
                    }}
                    className="rounded-full border border-white/20 bg-sky-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    title="Reset view (R)"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-6 bottom-6 z-[400] pointer-events-none">
              <div className="flex flex-col gap-3 pointer-events-auto rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-sm text-slate-100/85 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100/80">Training Guide</div>
                <p className="text-sm">
                  Drag to pan, scroll or use the buttons to zoom. Press R to reset and H to reveal the next clue.
                </p>
              </div>
            </div>

            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={1}
              zoomControl={false}
              attributionControl={false}
              className="h-full w-full"
              scrollWheelZoom={true}
              style={{ background: "radial-gradient(circle at top, #0f172a 0%, #020617 75%)" }}
            >
              <MapInstanceSetter onMapReady={handleMapReady} />
              {question && worldGeo && (
                <GeoJSONLayer
                  key={question.correctCountry}
                  data={worldGeo}
                  style={getFeatureStyle}
                  onEachFeature={onEachCountry}
                />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
