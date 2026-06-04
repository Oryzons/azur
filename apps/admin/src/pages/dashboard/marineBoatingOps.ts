import { getMarineForecastCoords } from './marineWeather';

export type BoatingScoreBand = 'green' | 'orange' | 'red';

export type DayBoatingOps = {
  dateIso: string;
  score: number;
  band: BoatingScoreBand;
  labelFr: string;
  factors: {
    windScore: number;
    gustScore: number;
    waveScore: number;
    rainScore: number;
    visibilityScore: number;
    windMaxKmh: number;
    gustMaxKmh: number;
    waveMaxM: number;
    rainSumMm: number;
    visibilityMinM: number | null;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 0 = mauvais, 100 = excellent (sortie loisir / calanques). */
function scoreWindMax(kmh: number): number {
  if (kmh <= 6) return 100;
  if (kmh >= 58) return 0;
  return 100 * (1 - (kmh - 6) / 52);
}

function scoreGustMax(kmh: number): number {
  if (kmh <= 12) return 100;
  if (kmh >= 68) return 0;
  return 100 * (1 - (kmh - 12) / 56);
}

function scoreWaveMax(m: number): number {
  if (m <= 0.25) return 100;
  if (m >= 2.4) return 0;
  return 100 * (1 - (m - 0.25) / 2.15);
}

function scoreRainDay(mm: number): number {
  if (mm <= 0.2) return 100;
  if (mm >= 18) return 0;
  return 100 * (1 - (mm - 0.2) / 17.8);
}

/** visibilité horaire min (m). */
function scoreVisibilityMin(m: number | null): number {
  if (m == null || !Number.isFinite(m)) return 88;
  if (m >= 18_000) return 100;
  if (m <= 900) return 0;
  return 100 * ((m - 900) / (18_000 - 900));
}

function combineScores(parts: {
  wind: number;
  gust: number;
  wave: number;
  rain: number;
  vis: number;
}): number {
  const w = { wind: 0.22, gust: 0.26, wave: 0.28, rain: 0.14, vis: 0.1 };
  const raw =
    parts.wind * w.wind +
    parts.gust * w.gust +
    parts.wave * w.wave +
    parts.rain * w.rain +
    parts.vis * w.vis;
  return Math.round(clamp(raw, 0, 100));
}

function bandFromScore(score: number): { band: BoatingScoreBand; labelFr: string } {
  if (score >= 76) return { band: 'green', labelFr: 'Conditions idéales' };
  if (score >= 46) return { band: 'orange', labelFr: 'Navigation modérée' };
  return { band: 'red', labelFr: 'Sorties déconseillées' };
}

type ForecastHourly = {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    precipitation?: (number | null)[];
    visibility?: (number | null)[];
  };
};

type MarineHourly = {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
  };
};

function alignWaveToForecastTimes(
  fTimes: string[],
  mTimes: string[],
  wave: (number | null)[],
): (number | null)[] {
  const idx = new Map<string, number>();
  for (let i = 0; i < mTimes.length; i++) {
    idx.set(mTimes[i], i);
  }
  return fTimes.map((t) => {
    const j = idx.get(t);
    if (j === undefined) return null;
    return wave[j] ?? null;
  });
}

export async function fetchDayBoatingOps(dateIso: string, signal?: AbortSignal): Promise<DayBoatingOps> {
  const { lat, lon } = getMarineForecastCoords();
  const tz = 'Europe/Paris';
  const common = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    forecast_days: '4',
  });

  const fp = new URLSearchParams(common);
  fp.set('hourly', 'wind_speed_10m,wind_gusts_10m,precipitation,visibility');

  const mp = new URLSearchParams(common);
  mp.set('cell_selection', 'sea');
  mp.set('hourly', 'wave_height');

  const [fr, mr] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${fp}`, { signal }),
    fetch(`https://marine-api.open-meteo.com/v1/marine?${mp}`, { signal }),
  ]);
  if (!fr.ok) throw new Error(`Forecast ${fr.status}`);
  if (!mr.ok) throw new Error(`Marine ${mr.status}`);

  const forecast = (await fr.json()) as ForecastHourly;
  const marine = (await mr.json()) as MarineHourly;

  const fTimes = forecast.hourly?.time ?? [];
  const wind = forecast.hourly?.wind_speed_10m ?? [];
  const gust = forecast.hourly?.wind_gusts_10m ?? [];
  const precip = forecast.hourly?.precipitation ?? [];
  const vis = forecast.hourly?.visibility ?? [];
  const mTimes = marine.hourly?.time ?? [];
  const waveH = marine.hourly?.wave_height ?? [];
  const waveAligned = alignWaveToForecastTimes(fTimes, mTimes, waveH);

  let windMaxDay = 0;
  let gustMaxDay = 0;
  let waveMaxDay = 0;
  let rainSum = 0;
  let visMin: number | null = null;

  for (let i = 0; i < fTimes.length; i++) {
    const t = fTimes[i] ?? '';
    if (!t.startsWith(dateIso)) continue;

    const w = wind[i] ?? 0;
    const g = gust[i] ?? 0;
    const pr = precip[i] ?? 0;
    const vi = vis[i];
    const wh = waveAligned[i] ?? 0;

    windMaxDay = Math.max(windMaxDay, w);
    gustMaxDay = Math.max(gustMaxDay, g);
    waveMaxDay = Math.max(waveMaxDay, wh);
    rainSum += pr;
    if (vi != null && Number.isFinite(vi)) {
      visMin = visMin === null ? vi : Math.min(visMin, vi);
    }
  }

  const windScore = scoreWindMax(windMaxDay);
  const gustScore = scoreGustMax(gustMaxDay);
  const waveScore = scoreWaveMax(waveMaxDay);
  const rainScore = scoreRainDay(rainSum);
  const visibilityScore = scoreVisibilityMin(visMin);

  const score = combineScores({
    wind: windScore,
    gust: gustScore,
    wave: waveScore,
    rain: rainScore,
    vis: visibilityScore,
  });
  const { band, labelFr } = bandFromScore(score);

  return {
    dateIso,
    score,
    band,
    labelFr,
    factors: {
      windScore,
      gustScore,
      waveScore,
      rainScore,
      visibilityScore,
      windMaxKmh: windMaxDay,
      gustMaxKmh: gustMaxDay,
      waveMaxM: waveMaxDay,
      rainSumMm: Math.round(rainSum * 10) / 10,
      visibilityMinM: visMin,
    },
  };
}
