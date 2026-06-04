import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const rt = useAuthStore.getState().refreshToken;
  if (!rt) return false;
  try {
    const { data } = await axios.post<{
      accessToken: string;
      refreshToken: string;
      user: import('@/stores/auth').AuthUserSlice;
    }>('/api/v1/auth/refresh', { refreshToken: rt }, { headers: { 'Content-Type': 'application/json' } });
    useAuthStore.getState().setSession(data);
    return true;
  } catch {
    useAuthStore.getState().clear();
    return false;
  }
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config;
    const status = err.response?.status;
    const url = original?.url ?? '';
    if (
      status !== 401 ||
      !original ||
      original.headers['X-Retry'] ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    ) {
      return Promise.reject(err);
    }
    if (!refreshing) refreshing = tryRefresh().finally(() => (refreshing = null));
    const ok = await refreshing;
    if (!ok) return Promise.reject(err);
    original.headers['X-Retry'] = '1';
    original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
    return api.request(original);
  },
);

export { api };
