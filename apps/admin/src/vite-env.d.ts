/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Latitude du point de prévision marine (décimal). Ex. 43.3586 (Port Ouest) */
  readonly VITE_MARINE_FORECAST_LAT?: string;
  /** Longitude du point de prévision marine (décimal). Ex. 5.2929 (Port Ouest) */
  readonly VITE_MARINE_FORECAST_LON?: string;
  /** Libellé affiché pour la localité météo. Ex. Port Ouest */
  readonly VITE_MARINE_FORECAST_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
