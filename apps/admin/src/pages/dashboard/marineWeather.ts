/** Coordonnées par défaut : Port Ouest Marseille — L'Estaque (base nautique Bleu Calanque). */
export const DEFAULT_MARINE_LAT = 43.3586;
export const DEFAULT_MARINE_LON = 5.2929;
export const DEFAULT_MARINE_LOCATION_LABEL = 'Port Ouest';

const METEO_FRANCE_MARINE_URL = 'https://meteofrance.com/meteo-marine';

export function getMarineForecastCoords(): { lat: number; lon: number } {
  const lat = Number(import.meta.env.VITE_MARINE_FORECAST_LAT);
  const lon = Number(import.meta.env.VITE_MARINE_FORECAST_LON);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return { lat: DEFAULT_MARINE_LAT, lon: DEFAULT_MARINE_LON };
}

/** Libellé affiché pour le point de prévision (localité). */
export function getMarineForecastLocationLabel(): string {
  const custom = import.meta.env.VITE_MARINE_FORECAST_LABEL?.trim();
  if (custom) return custom;
  const { lat, lon } = getMarineForecastCoords();
  if (lat === DEFAULT_MARINE_LAT && lon === DEFAULT_MARINE_LON) {
    return DEFAULT_MARINE_LOCATION_LABEL;
  }
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

export function meteoFranceMarineUrl(): string {
  return METEO_FRANCE_MARINE_URL;
}

export type MarineRiskLevel = 'calme' | 'modere' | 'vigilance' | 'difficile';

/** État synthétique pour le bouton du header (3 visuels). */
export type MarineHeadlineKind = 'bon' | 'vigilance' | 'danger';

export type MarineDaySummary = {
  dateIso: string;
  label: string;
  risk: MarineRiskLevel;
  riskLabel: string;
  windMaxKmh: number | null;
  gustMaxKmh: number | null;
  waveMaxM: number | null;
  windSeaMaxM: number | null;
  swellMaxM: number | null;
  swellPeriodMaxS: number | null;
  seaTempMaxC: number | null;
  weatherCode: number | null;
  weatherLabel: string;
};

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function weatherCodeLabelFr(code: number | null): string {
  if (code === null) return '—';
  if (code === 0) return 'Dégagé';
  if (code <= 3) return 'Peu nuageux';
  if (code <= 48) return 'Brouillard';
  if (code <= 57) return 'Bruine';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige / grésil';
  if (code <= 82) return 'Averses';
  if (code <= 86) return 'Averses de neige';
  if (code <= 99) return 'Orages';
  return 'Variable';
}

export function computeMarineRisk(
  windMaxKmh = 0,
  gustMaxKmh = 0,
  waveMaxM = 0,
): { level: MarineRiskLevel; label: string } {
  const score = Math.max(windMaxKmh, gustMaxKmh * 0.9);

  if (waveMaxM >= 2 || score >= 55) {
    return { level: 'difficile', label: 'Conditions difficiles' };
  }
  if (waveMaxM >= 1.2 || score >= 40) {
    return { level: 'vigilance', label: 'Vigilance mer formée' };
  }
  if (waveMaxM >= 0.6 || score >= 28) {
    return { level: 'modere', label: 'Mer modérée' };
  }
  return { level: 'calme', label: 'Conditions calmes' };
}

/** Résumé visuel header : bleu = favorable, orange = vigilance mer, rouge = vent fort / orage / conditions dures. */
export function getMarineHeadlineKind(day: MarineDaySummary): MarineHeadlineKind {
  const code = day.weatherCode;
  const gust = day.gustMaxKmh ?? 0;
  const wind = day.windMaxKmh ?? 0;

  if (
    day.risk === 'difficile' ||
    (code != null && code >= 95) ||
    gust >= 62 ||
    wind >= 55
  ) {
    return 'danger';
  }
  if (day.risk === 'vigilance' || (code != null && code >= 81)) {
    return 'vigilance';
  }
  return 'bon';
}

type MarineDailyResponse = {
  daily?: {
    time?: string[];
    wave_height_max?: (number | null)[];
    wind_wave_height_max?: (number | null)[];
    swell_wave_height_max?: (number | null)[];
    swell_wave_peak_period_max?: (number | null)[];
    sea_surface_temperature_max?: (number | null)[];
  };
};

type ForecastDailyResponse = {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
  };
};

const MARINE_FORECAST_DAY_COUNT = 3;

export async function fetchMarineDailyForecast(
  signal?: AbortSignal,
  dayCount: number = MARINE_FORECAST_DAY_COUNT,
): Promise<MarineDaySummary[]> {
  const { lat, lon } = getMarineForecastCoords();
  const tz = 'Europe/Paris';
  const days = Math.min(Math.max(dayCount, 1), 8);
  const common = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    forecast_days: String(days),
  });

  const marineParams = new URLSearchParams(common);
  marineParams.set('cell_selection', 'sea');
  marineParams.set(
    'daily',
    [
      'wave_height_max',
      'wind_wave_height_max',
      'swell_wave_height_max',
      'swell_wave_peak_period_max',
      'sea_surface_temperature_max',
    ].join(','),
  );

  const forecastParams = new URLSearchParams(common);
  forecastParams.set('daily', 'weather_code,wind_speed_10m_max,wind_gusts_10m_max');

  const [marineRes, forecastRes] = await Promise.all([
    fetch(`https://marine-api.open-meteo.com/v1/marine?${marineParams}`, { signal }),
    fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams}`, { signal }),
  ]);

  if (!marineRes.ok) {
    throw new Error(`Marine API ${marineRes.status}`);
  }
  if (!forecastRes.ok) {
    throw new Error(`Forecast API ${forecastRes.status}`);
  }

  const marine = (await marineRes.json()) as MarineDailyResponse;
  const forecast = (await forecastRes.json()) as ForecastDailyResponse;

  const mTime = marine.daily?.time ?? [];
  const fTime = forecast.daily?.time ?? [];
  if (mTime.length < days || fTime.length < days) {
    throw new Error('Réponse météo incomplète');
  }

  const waveH = marine.daily?.wave_height_max ?? [];
  const windSeaH = marine.daily?.wind_wave_height_max ?? [];
  const swellH = marine.daily?.swell_wave_height_max ?? [];
  const swellP = marine.daily?.swell_wave_peak_period_max ?? [];
  const sst = marine.daily?.sea_surface_temperature_max ?? [];
  const wCode = forecast.daily?.weather_code ?? [];
  const wSpd = forecast.daily?.wind_speed_10m_max ?? [];
  const wGst = forecast.daily?.wind_gusts_10m_max ?? [];

  const out: MarineDaySummary[] = [];
  for (let i = 0; i < days; i++) {
    const dateIso = mTime[i] ?? fTime[i] ?? '';
    const d = new Date(`${dateIso}T12:00:00`);
    const label = d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const windMaxKmh = wSpd[i] ?? null;
    const gustMaxKmh = wGst[i] ?? null;
    const waveMaxM = waveH[i] ?? null;
    const windSeaMaxM = windSeaH[i] ?? null;
    const swellMaxM = swellH[i] ?? null;
    const swellPeriodMaxS = swellP[i] ?? null;
    const seaTempMaxC = sst[i] ?? null;
    const weatherCode = wCode[i] ?? null;

    const { level, label: riskLabel } = computeMarineRisk(
      windMaxKmh ?? 0,
      gustMaxKmh ?? 0,
      waveMaxM ?? 0,
    );

    out.push({
      dateIso,
      label,
      risk: level,
      riskLabel,
      windMaxKmh,
      gustMaxKmh,
      waveMaxM,
      windSeaMaxM,
      swellMaxM,
      swellPeriodMaxS,
      seaTempMaxC,
      weatherCode,
      weatherLabel: weatherCodeLabelFr(weatherCode),
    });
  }

  return out;
}

export function formatKmh(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${round1(n)} km/h`;
}

export function formatMeters(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${round1(n)} m`;
}

export function formatSeconds(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${round1(n)} s`;
}

export function formatTempC(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${round1(n)} °C`;
}

export function kmhToKnots(kmh: number | null): string {
  if (kmh === null || Number.isNaN(kmh)) return '—';
  const kt = kmh / 1.852;
  return `≈ ${round1(kt)} nd`;
}

/** Échelle Beaufort 0–12 (seuils en nœuds, usage maritime courant). */
export function knotsToBeaufort(kn: number): number {
  if (!Number.isFinite(kn) || kn < 0) return 0;
  if (kn < 1) return 0;
  if (kn < 4) return 1;
  if (kn < 7) return 2;
  if (kn < 11) return 3;
  if (kn < 17) return 4;
  if (kn < 22) return 5;
  if (kn < 28) return 6;
  if (kn < 34) return 7;
  if (kn < 41) return 8;
  if (kn < 48) return 9;
  if (kn < 56) return 10;
  if (kn < 64) return 11;
  return 12;
}

export function kmhToBeaufort(kmh: number | null): number | null {
  if (kmh === null || Number.isNaN(kmh)) return null;
  return knotsToBeaufort(kmh / 1.852);
}

export function formatBeaufortFromKmh(kmh: number | null): string {
  const b = kmhToBeaufort(kmh);
  if (b === null) return '—';
  return `Bft ${b}`;
}
