import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, Ship } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import { OwnerFirstLoginPasswordModal } from '@/components/auth/OwnerFirstLoginPasswordModal';
import { useAuthStore } from '@/stores/auth';
import { invalidatePlanningStores } from '@/lib/invalidatePlanningStores';
import { homePathForRole, isOwnerUser, loginPathAfterAuth } from '@/lib/userRoles';

const inputCls =
  'w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-10 pr-3 text-[15px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';

export function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);
  const accessToken = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /** Mot de passe temporaire saisi à la connexion (pré-rempli dans la modale). */
  const [ownerTempPassword, setOwnerTempPassword] = useState<string | null>(null);
  const [passwordChangedHint, setPasswordChangedHint] = useState(() => {
    try {
      return sessionStorage.getItem('bc-owner-password-changed') === '1';
    } catch {
      return false;
    }
  });

  const ownerMustChangePassword = Boolean(accessToken && mustChangePassword && isOwnerUser(userRole));
  const showOwnerPasswordModal = ownerMustChangePassword;

  if (accessToken && !mustChangePassword) {
    return <Navigate to={homePathForRole(userRole)} replace />;
  }

  function handleOwnerPasswordSuccess() {
    setOwnerTempPassword(null);
    navigate(homePathForRole('OWNER'), { replace: true });
  }

  function handleUseOtherAccount() {
    setOwnerTempPassword(null);
    clear();
    setPassword('');
    setError('');
  }

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password: password.trim() });
      try {
        sessionStorage.removeItem('bc-owner-password-changed');
      } catch {
        /* ignore */
      }
      setPasswordChangedHint(false);
      invalidatePlanningStores();
      setSession(data);

      if (data.user?.mustChangePassword && isOwnerUser(data.user?.role)) {
        setOwnerTempPassword(password);
        return;
      }

      navigate(loginPathAfterAuth(data.user?.role, data.user?.mustChangePassword), { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) setError('Identifiants invalides.');
      else if (axios.isAxiosError(err) && err.response?.status && err.response.status >= 500)
        setError('Le serveur ne répond pas correctement. Réessayez dans un instant.');
      else setError('Connexion impossible. Vérifiez que l’API tourne et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <OwnerFirstLoginPasswordModal
        open={showOwnerPasswordModal}
        defaultCurrentPassword={ownerTempPassword ?? ''}
        onSuccess={handleOwnerPasswordSuccess}
        onUseOtherAccount={handleUseOtherAccount}
      />

      {/* Panneau marque */}
      <aside
        className="relative hidden overflow-hidden bg-gradient-to-br from-[#2d4a6f] via-[#416B9F] to-[#5b8ab8] lg:flex lg:flex-col lg:justify-between"
      >
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-[#1e3a5f]/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full bg-white/5"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-14 xl:px-14">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/95 shadow-lg shadow-[#1e3a5f]/30">
            <img
              src="/bleu-calanque-logo.png"
              alt=""
              className="h-11 w-11 object-contain"
              draggable={false}
            />
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-white xl:text-4xl">
            Bleu Calanque
          </h1>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-white/85">
            {ownerMustChangePassword
              ? 'Définissez votre mot de passe pour accéder à votre calendrier et vos indisponibilités.'
              : 'Gestion location — planning, réservations, check-in / check-out et paramètres de votre flotte.'}
          </p>
          <ul className="mt-10 space-y-3 text-sm text-white/75">
            <li className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Ship className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
              </span>
              Calendrier et réservations en temps réel
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Lock className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
              </span>
              Accès réservé à l’équipe et aux propriétaires
            </li>
          </ul>
        </div>

        <p className="relative z-10 px-10 pb-8 text-xs text-white/50 xl:px-14">
          © {new Date().getFullYear()} Bleu Calanque — usage interne
        </p>
      </aside>

      {/* Formulaire */}
      <main className="relative flex min-h-screen flex-col justify-center bg-[#f4f5f8] px-5 py-10 sm:px-8">
        {accessToken ? (
          <button
            type="button"
            onClick={() => handleUseOtherAccount()}
            className="absolute right-5 top-5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 sm:right-8 sm:top-8"
          >
            Se déconnecter
          </button>
        ) : null}
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white shadow-sm">
              <img src="/bleu-calanque-logo.png" alt="" className="h-8 w-8 object-contain" draggable={false} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-zinc-900">Bleu Calanque</p>
              <p className="text-xs text-zinc-500">
                {ownerMustChangePassword ? 'Espace propriétaire' : 'Gestion location'}
              </p>
            </div>
          </div>

          <div
            className={[
              'rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-200/50 sm:p-8',
              showOwnerPasswordModal ? 'pointer-events-none opacity-40' : '',
            ].join(' ')}
            aria-hidden={showOwnerPasswordModal}
          >
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Connexion</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {ownerMustChangePassword
                ? 'Finalisez votre mot de passe dans la fenêtre ci-dessus.'
                : 'Identifiez-vous pour accéder au back-office, à l’espace propriétaire ou à la tablette agents.'}
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5" autoComplete="on">
              {passwordChangedHint ? (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200/90 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900"
                >
                  Mot de passe mis à jour. Connectez-vous avec votre <strong>nouveau</strong> mot de passe (pas le
                  temporaire). Si la connexion échoue, effacez le mot de passe pré-rempli par le navigateur.
                </p>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200/90 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800"
                >
                  {error}
                </p>
              ) : null}

              <div>
                <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Email
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoFocus={!showOwnerPasswordModal}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="vous@exemple.fr"
                    autoComplete="email"
                    disabled={showOwnerPasswordModal}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Mot de passe
                </label>
                <div className="relative mt-1.5">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} pr-11`}
                    placeholder="••••••••"
                    autoComplete={passwordChangedHint ? 'new-password' : 'current-password'}
                    name={passwordChangedHint ? 'new-owner-password' : 'password'}
                    disabled={showOwnerPasswordModal}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-zinc-400 transition hover:text-zinc-700"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    disabled={showOwnerPasswordModal}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={2} aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || showOwnerPasswordModal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#416B9F] py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/25 transition hover:bg-[#365b87] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Connexion en cours…
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400">
            Problème de connexion ? Contactez un administrateur Bleu Calanque.
          </p>
        </div>
      </main>
    </div>
  );
}
