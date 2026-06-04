import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import type { AuthUserSlice } from '@/stores/auth';
import { useAuthStore } from '@/stores/auth';

const inputCls =
  'w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-10 pr-3 text-[15px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';

type Props = Readonly<{
  /** Mot de passe temporaire saisi à la connexion (pré-rempli si disponible). */
  defaultCurrentPassword?: string;
  onSuccess: () => void;
  onUseOtherAccount?: () => void;
}>;

export function FirstLoginPasswordForm({ defaultCurrentPassword = '', onSuccess, onUseOtherAccount }: Props) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setSession = useAuthStore((s) => s.setSession);

  const [currentPassword, setCurrentPassword] = useState(defaultCurrentPassword);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!currentPassword.trim() || !newPassword.trim()) {
      setError('Renseignez le mot de passe actuel et le nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPassword !== newPassword2) {
      setError('La confirmation ne correspond pas.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Le nouveau mot de passe doit être différent du mot de passe temporaire.');
      return;
    }

    setSaving(true);
    try {
      const current = currentPassword.trim();
      const next = newPassword.trim();
      const { data } = await api.patch<AuthUserSlice>('/users/me/password', {
        currentPassword: current,
        newPassword: next,
      });
      setSession({ accessToken, refreshToken, user: data });
      try {
        sessionStorage.setItem('bc-owner-password-changed', '1');
      } catch {
        /* ignore */
      }
      onSuccess();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Impossible de changer le mot de passe.'));
    } finally {
      setSaving(false);
    }
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
        Pour des raisons de sécurité, définissez votre mot de passe personnel avant d&apos;accéder à votre espace
        propriétaire.
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200/90 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-zinc-600">
        Connecté en tant que <span className="font-semibold text-zinc-900">{displayName}</span>
      </p>

      <div>
        <label htmlFor="first-login-current" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Mot de passe actuel (fourni par Bleu Calanque)
        </label>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            id="first-login-current"
            type={showCurrent ? 'text' : 'password'}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`${inputCls} pr-11`}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-zinc-400 transition hover:text-zinc-700"
            aria-label={showCurrent ? 'Masquer' : 'Afficher'}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="first-login-new" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Nouveau mot de passe
        </label>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            id="first-login-new"
            type={showNew ? 'text' : 'password'}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputCls} pr-11`}
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-zinc-400 transition hover:text-zinc-700"
            aria-label={showNew ? 'Masquer' : 'Afficher'}
          >
            {showNew ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="first-login-confirm" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Confirmer le nouveau mot de passe
        </label>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            id="first-login-confirm"
            type={showNew ? 'text' : 'password'}
            required
            minLength={8}
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#416B9F] py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/25 transition hover:bg-[#365b87] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Enregistrement…
          </>
        ) : (
          'Enregistrer et accéder à mon espace'
        )}
      </button>

      {onUseOtherAccount ? (
        <button
          type="button"
          onClick={onUseOtherAccount}
          className="w-full text-center text-sm font-medium text-zinc-500 transition hover:text-zinc-800"
        >
          Utiliser un autre compte
        </button>
      ) : null}
    </form>
  );
}
