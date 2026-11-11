import type { components } from "../types/api.generated";

type Schema = components["schemas"];
type Components = readonly [number, number, number, number];
type ScoreProfile = {
  components: Components;
  level: Schema["PuntoRankingItem"]["nivel_riesgo"];
};
type PointSeed = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  counts: readonly number[];
  deaths: number;
  serious: number;
  period: ScoreProfile;
  annual: ScoreProfile;
  schoolDistance: number | null;
  busDistance: number | null;
};

export const DEMO_DATA = Object.freeze({
  comuna: "Concepción",
  startYear: 2020,
  endYear: 2025,
  calculatedAt: "2026-11-01T12:00:00.000Z",
  version: "demo-v1",
});

// Credenciales públicas y ficticias; no corresponden a cuentas de un servidor.
export const DEMO_CREDENTIALS = Object.freeze({
  inspector: "inspector@demo.alervi.test",
  administrator: "administrador@demo.alervi.test",
  blocked: "bloqueado@demo.alervi.test",
  password: "DemoALERVI2026!",
  mfaCode: "123456",
});

export const demoUsers: Record<
  "inspector" | "administrador",
  Schema["UsuarioResponse"]
> = {
  inspector: {
    id_usuario: 9001,
    correo: DEMO_CREDENTIALS.inspector,
    rol: "inspector",
    activo: true,
    fecha_creacion: "2026-10-01T09:00:00.000Z",
  },
  administrador: {
    id_usuario: 9002,
    correo: DEMO_CREDENTIALS.administrator,
    rol: "administrador",
    activo: true,
    fecha_creacion: "2026-10-01T09:00:00.000Z",
  },
};

export const demoWeights: Schema["PonderacionesScoringDto"] = {
  version: DEMO_DATA.version,
  w_severidad: 0.4,
  w_frecuencia: 0.25,
  w_tendencia: 0.2,
  w_contexto: 0.15,
  suma_pesos: 1,
  fecha_calibracion: DEMO_DATA.calculatedAt,
  modificado_por: DEMO_CREDENTIALS.administrator,
  descripcion_cambio: "Configuración sintética. Solo existe en memoria.",
  es_vigente: true,
};

// Orden y niveles predeterminados: 9103 precede a 9102 en el empate por fallecidos.
// Los componentes son perfiles sintéticos, no un cálculo desde siniestros u OSM.
const points: readonly PointSeed[] = [
  {
    id: 9101,
    name: "Demo 01 · Sector Los Carrera",
    latitude: -36.8189,
    longitude: -73.0453,
    counts: [10, 12, 13, 14, 15, 16],
    deaths: 1,
    serious: 3,
    period: { components: [96, 88, 80, 72], level: "CRITICO" },
    annual: { components: [90, 80, 64, 72], level: "ALTO" },
    schoolDistance: 95,
    busDistance: 40,
  },
  {
    id: 9103,
    name: "Demo 02 · Sector O'Higgins",
    latitude: -36.8256,
    longitude: -73.0479,
    counts: [8, 8, 9, 9, 10, 10],
    deaths: 1,
    serious: 2,
    period: { components: [80, 76, 64, 60], level: "ALTO" },
    annual: { components: [80, 60, 60, 60], level: "ALTO" },
    schoolDistance: null,
    busDistance: 55,
  },
  {
    id: 9102,
    name: "Demo 03 · Sector Barros Arana",
    latitude: -36.8231,
    longitude: -73.0541,
    counts: [7, 8, 8, 8, 9, 9],
    deaths: 0,
    serious: 2,
    period: { components: [80, 76, 64, 60], level: "ALTO" },
    annual: { components: [80, 60, 60, 60], level: "ALTO" },
    schoolDistance: 120,
    busDistance: 70,
  },
  {
    id: 9104,
    name: "Demo 04 · Sector Chacabuco",
    latitude: -36.8281,
    longitude: -73.0508,
    counts: [4, 4, 5, 5, 6, 6],
    deaths: 0,
    serious: 1,
    period: { components: [50, 56, 40, 40], level: "MEDIO" },
    annual: { components: [40, 40, 30, 40], level: "MEDIO" },
    schoolDistance: 110,
    busDistance: null,
  },
  {
    id: 9105,
    name: "Demo 05 · Sector Plaza España",
    latitude: -36.8314,
    longitude: -73.0569,
    counts: [1, 1, 2, 2, 3, 3],
    deaths: 0,
    serious: 0,
    period: { components: [20, 24, 20, 12], level: "BAJO" },
    annual: { components: [10, 16, 10, 12], level: "BAJO" },
    schoolDistance: null,
    busDistance: 130,
  },
  {
    id: 9106,
    name: "Demo 06 · Serie completa con cero siniestros",
    latitude: -36.8248,
    longitude: -73.0412,
    counts: [0, 0, 0, 0, 0, 0],
    deaths: 0,
    serious: 0,
    period: { components: [0, 0, 0, 0], level: "BAJO" },
    annual: { components: [0, 0, 0, 0], level: "BAJO" },
    schoolDistance: null,
    busDistance: null,
  },
];

export const demoUnscoredPoint: Schema["PuntoSinIndiceItem"] = {
  id_punto: 9199,
  nombre_interseccion: "Demo 07 · Serie incompleta",
  comuna: DEMO_DATA.comuna,
  latitud: -36.8205,
  longitud: -73.0518,
  motivo: "La serie sintética no tiene antecedentes suficientes para calcular el índice.",
  estado_indice: "SIN_INDICE_DISPONIBLE",
};

function history(point: PointSeed): Schema["HistoricoSiniestrosAnual"][] {
  return point.counts.map((count, index) => ({
    anio: DEMO_DATA.startYear + index,
    cantidad_siniestros: count,
    fallecidos: point.deaths,
    graves: point.serious,
    menos_graves: count > 0 ? 1 : 0,
    leves: count - point.deaths - point.serious - (count > 0 ? 1 : 0),
  }));
}

function breakdown(profile: ScoreProfile): Schema["DesgloseFactoresScoring"] {
  const [severidad, frecuencia, tendencia, contexto] = profile.components;
  return {
    formula: "IP = w1*S + w2*F + w3*T + w4*C",
    w_severidad: demoWeights.w_severidad,
    severidad_s: severidad,
    aporte_severidad: severidad * demoWeights.w_severidad,
    w_frecuencia: demoWeights.w_frecuencia,
    frecuencia_f: frecuencia,
    aporte_frecuencia: frecuencia * demoWeights.w_frecuencia,
    w_tendencia: demoWeights.w_tendencia,
    tendencia_t: tendencia,
    aporte_tendencia: tendencia * demoWeights.w_tendencia,
    w_contexto: demoWeights.w_contexto,
    contexto_c: contexto,
    aporte_contexto: contexto * demoWeights.w_contexto,
  };
}

// Solo construye instantáneas de fixtures: sin ordenar, normalizar ni recalcular
// con las ponderaciones que después se editen en el transporte mock.
export function rankingFixture(
  start: number,
  end: number,
): Schema["RankingResponse"] {
  const period = start === end ? String(start) : `${start}-${end}`;
  return {
    total_puntos: points.length + 1,
    configuracion_version: DEMO_DATA.version,
    fecha_calculo: DEMO_DATA.calculatedAt,
    comuna: DEMO_DATA.comuna,
    periodo: period,
    puntos: points.map((point, index) => {
      const rows = history(point).filter(
        (row) => row.anio >= start && row.anio <= end,
      );
      const profile = start === end ? point.annual : point.period;
      const score = breakdown(profile);
      const priority =
        score.aporte_severidad + score.aporte_frecuencia +
        score.aporte_tendencia + score.aporte_contexto;
      return {
        id_punto: point.id,
        posicion_ranking: index + 1,
        nombre_interseccion: point.name,
        comuna: DEMO_DATA.comuna,
        latitud: point.latitude,
        longitud: point.longitude,
        nivel_riesgo: profile.level,
        indice_prioridad: Number(priority.toFixed(3)),
        severidad_s: score.severidad_s,
        frecuencia_f: score.frecuencia_f,
        tendencia_t: score.tendencia_t,
        contexto_c: score.contexto_c,
        total_siniestros: rows.reduce(
          (total, row) => total + row.cantidad_siniestros, 0,
        ),
        total_fallecidos: rows.reduce(
          (total, row) => total + row.fallecidos, 0,
        ),
        total_graves: rows.reduce((total, row) => total + row.graves, 0),
        estado_indice: "CALCULADO",
      };
    }),
    puntos_sin_indice: [
      {
        ...demoUnscoredPoint,
        motivo: `${demoUnscoredPoint.motivo} Período: ${period}.`,
      },
    ],
  };
}

const fullRanking = rankingFixture(DEMO_DATA.startYear, DEMO_DATA.endYear);

// El contrato público requiere IP numérico; el punto sin índice solo se entrega
// por ranking, sin inventar un IP cero ni ampliar el esquema GeoJSON.
export const demoRisk: Schema["GeoJsonFeatureCollection"] = {
  type: "FeatureCollection",
  features: fullRanking.puntos.map((point) => ({
    type: "Feature",
    id: point.id_punto,
    geometry: { type: "Point", coordinates: [point.longitud, point.latitud] },
    properties: {
      id_punto: point.id_punto,
      nombre_interseccion: point.nombre_interseccion,
      comuna: point.comuna,
      nivel_riesgo: point.nivel_riesgo,
      indice_prioridad: point.indice_prioridad,
      total_siniestros: point.total_siniestros,
      total_fallecidos: point.total_fallecidos,
      total_graves: point.total_graves,
      resumen_publico: "Datos sintéticos del período 2020-2025. No describen siniestros reales.",
    },
  })),
};

export const demoDetails: Schema["PuntoCriticoTecnicoDetail"][] = points.map((point, index) => {
  const ranked = fullRanking.puntos[index];
  return {
    id_punto: point.id,
    nombre_interseccion: point.name,
    comuna: DEMO_DATA.comuna,
    latitud: point.latitude,
    longitud: point.longitude,
    nivel_riesgo: point.period.level,
    indice_prioridad: ranked.indice_prioridad,
    estado_indice: "CALCULADO",
    configuracion_pesos_version: DEMO_DATA.version,
    desglose_scoring: breakdown(point.period),
    historico_anual: history(point),
    entorno_urbano: {
      buffer_metros: 150,
      total_colegios_buffer: point.schoolDistance === null ? 0 : 1,
      total_paraderos_buffer: point.busDistance === null ? 0 : 1,
      colegio_mas_cercano: point.schoolDistance === null ? null : {
        id_elemento: point.id * 10,
        nombre: `Colegio sintético ${point.id}`,
        categoria: "colegio",
        distancia_m: point.schoolDistance,
      },
      paradero_mas_cercano: point.busDistance === null ? null : {
        id_elemento: point.id * 10 + 1,
        nombre: `Paradero sintético ${point.id}`,
        categoria: "paradero",
        distancia_m: point.busDistance,
      },
    },
    total_fichas_inspeccion: 0,
    explicacion_tecnica: "Instantánea sintética del período 2020-2025, con factores y distancias predefinidos. No utiliza un motor geoespacial ni se recalcula al editar pesos en memoria.",
    advertencia_legal: "El índice expresa prioridad relativa; no representa probabilidad individual de un siniestro ni garantiza la seguridad de una vía.",
  };
});
