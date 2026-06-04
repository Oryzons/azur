/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Latitude du point de prévision marine (décimal). Ex. 43.29 */
  readonly VITE_MARINE_FORECAST_LAT?: string;
  /** Longitude du point de prévision marine (décimal). Ex. 5.33 */
  readonly VITE_MARINE_FORECAST_LON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
