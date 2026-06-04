import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function RegisterPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const target = '/dashboard';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (accessToken) return <Navigate to={target} replace />;

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        firstName,
        lastName,
        email,
        password,
      });
      setSession(data);
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(typeof msg === 'string' ? msg : 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4">
      <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Inscription</h1>
        <p className="mt-1 text-sm text-slate-400">Compte staff (rôle STAFF par défaut)</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error ? <p className="rounded-lg bg-red-950/80 px-3 py-2 text-sm text-red-200">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="register-firstName" className="block text-xs font-medium text-slate-400">
                Prénom
              </label>
              <input
                id="register-firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label htmlFor="register-lastName" className="block text-xs font-medium text-slate-400">
                Nom
              </label>
              <input
                id="register-lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-600"
              />
            </div>
          </div>
          <div>
            <label htmlFor="register-email" className="block text-xs font-medium text-slate-400">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-600"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="block text-xs font-medium text-slate-400">
              Mot de passe (8+ caractères)
            </label>
            <input
              id="register-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-600"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-sky-400 hover:underline">
            Connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
