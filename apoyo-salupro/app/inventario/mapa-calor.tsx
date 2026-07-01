"use client";

/**
 * MapaCalor — Mapa de solicitudes 2D/3D con marcadores agrupados (MapLibre).
 *
 * Stack: maplibre-gl + react-map-gl/maplibre.
 * Tiles: MapTiler vía NEXT_PUBLIC_MAPTILER_KEY si está presente. Sin key, usa proveedores
 * públicos sin API key: OpenFreeMap (calles con detalle completo), Esri World Imagery
 * (satélite) y AWS Terrarium DEM (relieve 3D) — así el mapa nunca cae a la vista plana
 * de demo de MapLibre.
 *
 * Cada marcador agrupa las solicitudes cercanas (~110 m) y muestra la cantidad; al hacer
 * clic abre un modal con el detalle de cada solicitud (persona, contacto, secciones, notas).
 *
 * Importar SIEMPRE dinámico con ssr:false (usa `window`/WebGL).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { SolicitudMapModal } from "./solicitud-map-modal";

/* ── Tipos públicos ───────────────────────────────────────────────────────── */
export interface PuntoCalor {
  lat: number;
  lng: number;
  weight?: number;
  id?: string;
  nombre?: string;
  estado?: string;
  tipoSolicitante?: string;
  telefono?: string | null;
  correo?: string | null;
  cedulaRif?: string | null;
  direccion?: string | null;
  notas?: string | null;
  seccionesSolicitadas?: unknown;
  createdAt?: string;
}
export interface MapaCalorProps {
  puntos: PuntoCalor[];
  centroInicial?: { lat: number; lng: number; zoom?: number };
  modoInicial?: "2d" | "3d";
  /** Altura del contenedor. Por defecto ocupa el padre (h-full). */
  className?: string;
  /** Abre el mapa directo en pantalla completa (el usuario puede salir con ✕ o Esc). */
  autoFullscreen?: boolean;
}

/** Agrupa puntos cercanos (~110 m, 3 decimales) en un solo marcador con contador. */
function agruparPuntos(puntos: PuntoCalor[]) {
  const grupos = new Map<string, PuntoCalor[]>();
  for (const p of puntos) {
    const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    const arr = grupos.get(key);
    if (arr) arr.push(p);
    else grupos.set(key, [p]);
  }
  return [...grupos.entries()].map(([key, items]) => {
    const [lat, lng] = key.split(",").map(Number);
    return { key, lat, lng, items };
  });
}

/* ── Config geográfica: La Guaira (estado Vargas), Venezuela ──────────────── */
const LA_GUAIRA = { lat: 10.6, lng: -66.93, zoom: 12 };

/** Zonas/parroquias para filtrar (bbox aprox + centro para volar). */
const ZONAS: { id: string; nombre: string; lat: number; lng: number; zoom: number; bbox: [number, number, number, number] }[] = [
  // bbox = [minLng, minLat, maxLng, maxLat]
  { id: "catia-la-mar", nombre: "Catia La Mar",  lat: 10.598, lng: -67.025, zoom: 13, bbox: [-67.10, 10.55, -66.97, 10.62] },
  { id: "maiquetia",    nombre: "Maiquetía",     lat: 10.60,  lng: -66.97,  zoom: 13, bbox: [-66.99, 10.56, -66.93, 10.62] },
  { id: "la-guaira",    nombre: "La Guaira",     lat: 10.601, lng: -66.931, zoom: 14, bbox: [-66.95, 10.58, -66.90, 10.62] },
  { id: "macuto",       nombre: "Macuto",        lat: 10.607, lng: -66.892, zoom: 14, bbox: [-66.91, 10.58, -66.85, 10.63] },
  { id: "caraballeda",  nombre: "Caraballeda",   lat: 10.612, lng: -66.852, zoom: 13, bbox: [-66.87, 10.58, -66.80, 10.64] },
  { id: "naiguata",     nombre: "Naiguatá",      lat: 10.617, lng: -66.74,  zoom: 13, bbox: [-66.80, 10.58, -66.65, 10.66] },
];

/* ── Estilos de mapa ──────────────────────────────────────────────────────── */
const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const HAS_KEY = !!KEY;

/** Satélite público sin key: mosaico Esri World Imagery. */
const ESRI_SATELLITE_STYLE = {
  version: 8 as const,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri-satellite", type: "raster" as const, source: "esri" }],
};

const STYLE = {
  // Sin key: OpenFreeMap "liberty" — vector style público con calles, nombres y POIs completos.
  streets: HAS_KEY
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${KEY}`
    : "https://tiles.openfreemap.org/styles/liberty",
  satellite: HAS_KEY
    ? `https://api.maptiler.com/maps/satellite/style.json?key=${KEY}`
    : ESRI_SATELLITE_STYLE,
};

/** Relieve 3D: MapTiler DEM con key; AWS Terrarium (público, sin key) de respaldo. */
const TERRAIN_SOURCE = HAS_KEY
  ? { url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${KEY}`, tileSize: 256 }
  : {
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium" as const,
      maxzoom: 15,
    };

export default function MapaCalor({
  puntos,
  centroInicial,
  modoInicial = "2d",
  className = "",
  autoFullscreen = false,
}: MapaCalorProps) {
  const centro = centroInicial ?? LA_GUAIRA;
  const mapRef = useRef<MapRef>(null);
  const [modo, setModo] = useState<"2d" | "3d">(modoInicial);
  const [capa, setCapa] = useState<"streets" | "satellite">("streets");
  const [zona, setZona] = useState("");
  const [fullscreen, setFullscreen] = useState(autoFullscreen);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<PuntoCalor[] | null>(null);

  /* Redimensiona el canvas WebGL al entrar/salir de pantalla completa. */
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.getMap().resize(), 220);
    return () => clearTimeout(id);
  }, [fullscreen]);

  /* Esc para salir de pantalla completa. */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  /* Filtrado por zona (bbox). Vacío = todos. */
  const puntosFiltrados = useMemo(() => {
    if (!zona) return puntos;
    const z = ZONAS.find((x) => x.id === zona);
    if (!z) return puntos;
    const [minLng, minLat, maxLng, maxLat] = z.bbox;
    return puntos.filter(
      (p) => p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat,
    );
  }, [puntos, zona]);

  /* ── Marcadores agrupados por cercanía (~110 m) ───────────────────────── */
  const grupos = useMemo(() => agruparPuntos(puntosFiltrados), [puntosFiltrados]);

  /* ── Activa/desactiva relieve 3D sobre el mapa MapLibre ───────────────── */
  const aplicarTerreno = useCallback((activo: boolean) => {
    const map = mapRef.current?.getMap();
    if (!map || !TERRAIN_SOURCE) return;
    try {
      if (activo) {
        if (!map.getSource("terrain-dem")) {
          map.addSource("terrain-dem", { type: "raster-dem", ...TERRAIN_SOURCE });
        }
        map.setTerrain({ source: "terrain-dem", exaggeration: 1.4 });
      } else {
        map.setTerrain(null);
      }
    } catch {
      /* el estilo aún no terminó de cargar; se reintenta en onLoad */
    }
  }, []);

  /* ── Toggle 2D / 3D: inclina cámara + (des)activa terreno ─────────────── */
  const toggleModo = (nuevo: "2d" | "3d") => {
    setModo(nuevo);
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (nuevo === "3d") {
      aplicarTerreno(true);
      map.easeTo({ pitch: 58, bearing: -15, duration: 800 }); // cámara inclinada
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      aplicarTerreno(false);
    }
  };

  const centrarEnZona = (id: string) => {
    setZona(id);
    const map = mapRef.current?.getMap();
    const z = ZONAS.find((x) => x.id === id);
    if (map && z) map.flyTo({ center: [z.lng, z.lat], zoom: z.zoom, duration: 1000 });
    else if (map) map.flyTo({ center: [centro.lng, centro.lat], zoom: centro.zoom ?? 12, duration: 1000 });
  };

  const onLoad = useCallback(() => {
    if (modo === "3d") {
      aplicarTerreno(true);
      mapRef.current?.getMap().easeTo({ pitch: 58, bearing: -15, duration: 0 });
    }
  }, [modo, aplicarTerreno]);

  const btn = (active: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
      active ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[60] w-screen h-screen overflow-hidden bg-black"
          : `relative w-full h-full overflow-hidden rounded-xl ${className}`
      }
    >
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: centro.lng,
          latitude: centro.lat,
          zoom: centro.zoom ?? 12,
          pitch: modoInicial === "3d" ? 58 : 0,
          bearing: modoInicial === "3d" ? -15 : 0,
        }}
        mapStyle={capa === "satellite" && STYLE.satellite ? STYLE.satellite : STYLE.streets}
        maxPitch={75}
        onLoad={onLoad}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" visualizePitch />

        {grupos.map((g) => (
          <Marker key={g.key} longitude={g.lng} latitude={g.lat} anchor="center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGrupoSeleccionado(g.items);
              }}
              className="group relative flex items-center justify-center"
              title={`${g.items.length} solicitud${g.items.length !== 1 ? "es" : ""} · ver detalle`}
            >
              <span className="absolute inset-0 rounded-full bg-crisis/30 scale-100 group-hover:scale-125 transition-transform duration-150 ease-out" />
              <span className="relative flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full bg-crisis text-white text-xs font-bold shadow-md border-2 border-white transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-90">
                {g.items.length}
              </span>
            </button>
          </Marker>
        ))}
      </MapGL>

      {/* ── Controles flotantes ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        {/* 2D / 3D */}
        <div className="flex gap-1 bg-muted/95 backdrop-blur rounded-lg p-1 shadow-sm border border-border">
          <button type="button" onClick={() => toggleModo("2d")} className={btn(modo === "2d")}>2D</button>
          <button
            type="button"
            onClick={() => toggleModo("3d")}
            className={btn(modo === "3d")}
            title="Relieve 3D"
          >
            3D
          </button>
        </div>
        {/* Mapa / Satélite */}
        {STYLE.satellite && (
          <div className="flex gap-1 bg-muted/95 backdrop-blur rounded-lg p-1 shadow-sm border border-border">
            <button type="button" onClick={() => setCapa("streets")} className={btn(capa === "streets")}>Mapa</button>
            <button type="button" onClick={() => setCapa("satellite")} className={btn(capa === "satellite")}>Satélite</button>
          </div>
        )}
      </div>

      {/* ── Filtro por zona + centrar ───────────────────────────────────── */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <select
          value={zona}
          onChange={(e) => centrarEnZona(e.target.value)}
          className="text-xs font-semibold bg-white/95 backdrop-blur border border-border rounded-lg px-2.5 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-ring text-gray-700"
        >
          <option value="">Todas las zonas</option>
          {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <button
          type="button"
          onClick={() => { setZona(""); mapRef.current?.getMap().flyTo({ center: [LA_GUAIRA.lng, LA_GUAIRA.lat], zoom: LA_GUAIRA.zoom, duration: 1000 }); }}
          className="text-xs font-semibold bg-white/95 backdrop-blur border border-border rounded-lg px-2.5 py-1.5 shadow-sm hover:text-primary transition-colors"
          title="Centrar en La Guaira"
        >
          ⌖
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="text-xs font-semibold bg-white/95 backdrop-blur border border-border rounded-lg px-2.5 py-1.5 shadow-sm hover:text-primary transition-colors"
          title={fullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
        >
          {fullscreen ? "✕" : "⛶"}
        </button>
      </div>

      {/* ── Leyenda ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-border">
        <span className="flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1 rounded-full bg-crisis text-white text-[10px] font-bold shrink-0">
          {puntosFiltrados.length}
        </span>
        <p className="text-[10px] font-semibold text-gray-500 leading-tight">
          solicitud{puntosFiltrados.length !== 1 ? "es" : ""} · el número marca cuántas hay en esa zona,
          <br />
          toca un punto para ver el detalle
        </p>
      </div>

      {grupoSeleccionado && (
        <SolicitudMapModal puntos={grupoSeleccionado} onClose={() => setGrupoSeleccionado(null)} />
      )}
    </div>
  );
}
