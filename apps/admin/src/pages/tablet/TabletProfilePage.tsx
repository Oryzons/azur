import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import { TB } from '@/lib/tabletTheme';
import { useAuthStore } from '@/stores/auth';

/** Changement de mot de passe obligatoire (comptes agent tablette). */
export function TabletProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setSession = useAuthStore((s) => s.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== newPassword2) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/users/me/password', { currentPassword, newPassword });
      setSession({ accessToken, refreshToken, user: data });
      navigate('/tablette/aujourdhui', { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Impossible de changer le mot de passe.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${TB.shell} justify-center px-4 py-8`}>
      <div className={`mx-auto w-full max-w-md ${TB.card} p-6`}>
        <h1 className={TB.h1}>Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bonjour {user.firstName}, définissez votre mot de passe pour accéder à l&apos;espace agent.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          {error ? <p className={TB.error}>{error}</p> : null}
          <label className="block text-sm font-medium text-zinc-700">
            Mot de passe actuel (fourni par l&apos;admin)
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={TB.input}
              autoComplete="current-password"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Nouveau mot de passe
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={TB.input}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Confirmer
            <input
              type="password"
              required
              minLength={8}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className={TB.input}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={saving} className={`w-full ${TB.btnPrimary}`}>
            {saving ? 'Enregistrement…' : 'Continuer'}
          </button>
        </form>
      </div>
    </div>
  );
}
