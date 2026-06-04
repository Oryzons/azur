import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUserSlice } from '@/stores/auth';
import { formatPhoneInput } from '@/lib/phone';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { fileToCompressedDataUrl } from '@/lib/mediaPhotos';
import { isOwnerUser } from '@/lib/userRoles';

type Civility = '' | 'M.' | 'Mme' | 'Mx';

function isoDateOnly(iso: string | null | undefined) {
  if (!iso) return '';
  // ISO -> YYYY-MM-DD
  return iso.slice(0, 10);
}

export function ProfilePage() {
  useDefaultPageFilters('Profil');
  const storeUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [civility, setCivility] = useState<Civility>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD
  const [nationality, setNationality] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [company, setCompany] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const email = storeUser.email;
  const mustChangePassword = Boolean(storeUser.mustChangePassword);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get<AuthUserSlice>('/users/me');
        if (cancelled) return;
        setCivility((data.civility as Civility) ?? '');
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setPhone(data.phone ?? '');
        setBirthDate(isoDateOnly(data.birthDate));
        setNationality(data.nationality ?? '');
        setAddress(data.address ?? '');
        setCity(data.city ?? '');
        setPostalCode(data.postalCode ?? '');
        setCountry(data.country ?? '');
        setCompany(data.company ?? '');
        setAvatarUrl(data.avatarUrl ?? null);
        setAvatarPreview(data.avatarUrl ?? null);

        // sync store (ex: sidebar avatar)
        setSession({ accessToken, refreshToken, user: data });
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setError('Impossible de charger le profil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, setSession]);

  const initials = useMemo(() => {
    const f = firstName.trim().charAt(0);
    const l = lastName.trim().charAt(0);
    return (f || l ? `${f}${l}` : '?').toUpperCase();
  }, [firstName, lastName]);

  async function onAvatarFile(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.');
      return;
    }
    const dataUrl = await fileToCompressedDataUrl(file);
    setAvatarUrl(dataUrl);
    setAvatarPreview(dataUrl);
  }

  async function onSubmit(e: any) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        civility: civility || null,
        firstName,
        lastName,
        phone: phone || null,
        birthDate: birthDate ? new Date(`${birthDate}T00:00:00.000Z`).toISOString() : null,
        nationality: nationality || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        country: country || null,
        company: company || null,
        avatarUrl: avatarUrl || null,
      };
      const { data } = await api.patch<AuthUserSlice>('/users/me', payload);
      setSession({ accessToken, refreshToken, user: data });
      setSuccess('Profil mis à jour.');
    } catch {
      setError('Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword() {
    setPwError('');
    setPwSuccess('');
    if (!currentPassword || !newPassword) {
      setPwError('Veuillez renseigner le mot de passe actuel et le nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPassword !== newPassword2) {
      setPwError('La confirmation ne correspond pas.');
      return;
    }
    setPwSaving(true);
    try {
      const { data } = await api.patch<AuthUserSlice>('/users/me/password', { currentPassword, newPassword });
      setSession({ accessToken, refreshToken, user: data });
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setPwSuccess('Mot de passe mis à jour.');
    } catch {
      setPwError('Impossible de changer le mot de passe.');
    } finally {
      setPwSaving(false);
    }
  }

  const ids = useMemo(
    () => ({
      civility: 'profile-civility',
      phone: 'profile-phone',
      firstName: 'profile-firstName',
      lastName: 'profile-lastName',
      birthDate: 'profile-birthDate',
      nationality: 'profile-nationality',
      address: 'profile-address',
      city: 'profile-city',
      postalCode: 'profile-postalCode',
      country: 'profile-country',
      company: 'profile-company',
      avatar: 'profile-avatar',
      currentPassword: 'profile-currentPassword',
      newPassword: 'profile-newPassword',
      newPassword2: 'profile-newPassword2',
    }),
    [],
  );

  if (mustChangePassword && isOwnerUser(storeUser.role)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Profil</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">
          Gère tes informations personnelles. Ces champs seront réutilisés plus tard (documents, emails, état des lieux).
        </p>
      </div>

      {mustChangePassword ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Pour des raisons de sécurité, vous devez changer votre mot de passe lors de la première connexion.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#416B9F] text-lg font-semibold text-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zinc-900">
                  {firstName || lastName ? `${firstName} ${lastName}` : '—'}
                </p>
                <p className="truncate text-sm text-zinc-500">{email}</p>
              </div>
            </div>
            <label
              htmlFor={ids.avatar}
              className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Changer la photo
            </label>
            <input
              id={ids.avatar}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onAvatarFile(f);
              }}
            />
          </div>
          <p className="mt-3 text-xs text-zinc-400">Formats image. Taille max 1.5 MB. Stockage temporaire (MVP).</p>
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-200/40">
          <h2 className="text-sm font-semibold text-zinc-800">Informations</h2>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-500">Chargement…</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={ids.civility} className="text-xs font-semibold text-zinc-500">
                  Civilité
                </label>
                <select
                  id={ids.civility}
                  value={civility}
                  onChange={(e) => setCivility(e.target.value as Civility)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                >
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Mx">Mx</option>
                </select>
              </div>

              <div>
                <label htmlFor={ids.phone} className="text-xs font-semibold text-zinc-500">
                  Téléphone
                </label>
                <input
                  id={ids.phone}
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                  placeholder="ex: 06 12 34 56 78"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                />
              </div>

              <div>
                <label htmlFor={ids.firstName} className="text-xs font-semibold text-zinc-500">
                  Prénom
                </label>
                <input
                  id={ids.firstName}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>

              <div>
                <label htmlFor={ids.lastName} className="text-xs font-semibold text-zinc-500">
                  Nom
                </label>
                <input
                  id={ids.lastName}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>

              <div>
                <label htmlFor={ids.birthDate} className="text-xs font-semibold text-zinc-500">
                  Date de naissance
                </label>
                <input
                  id={ids.birthDate}
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>

              <div>
                <label htmlFor={ids.nationality} className="text-xs font-semibold text-zinc-500">
                  Nationalité
                </label>
                <input
                  id={ids.nationality}
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                  placeholder="Française…"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor={ids.address} className="text-xs font-semibold text-zinc-500">
                  Adresse
                </label>
                <input
                  id={ids.address}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                  placeholder="Rue, numéro…"
                />
              </div>

              <div>
                <label htmlFor={ids.city} className="text-xs font-semibold text-zinc-500">
                  Ville
                </label>
                <input
                  id={ids.city}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>

              <div>
                <label htmlFor={ids.postalCode} className="text-xs font-semibold text-zinc-500">
                  Code postal
                </label>
                <input
                  id={ids.postalCode}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>

              <div>
                <label htmlFor={ids.country} className="text-xs font-semibold text-zinc-500">
                  Pays
                </label>
                <input
                  id={ids.country}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                  placeholder="France…"
                />
              </div>

              <div>
                <label htmlFor={ids.company} className="text-xs font-semibold text-zinc-500">
                  Société
                </label>
                <input
                  id={ids.company}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-200/40">
          <h2 className="text-sm font-semibold text-zinc-800">Mot de passe</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={ids.currentPassword} className="text-xs font-semibold text-zinc-500">
                Mot de passe actuel
              </label>
              <input
                id={ids.currentPassword}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor={ids.newPassword} className="text-xs font-semibold text-zinc-500">
                Nouveau mot de passe
              </label>
              <input
                id={ids.newPassword}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor={ids.newPassword2} className="text-xs font-semibold text-zinc-500">
                Confirmer
              </label>
              <input
                id={ids.newPassword2}
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]"
                autoComplete="new-password"
              />
            </div>
            {pwError ? (
              <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pwError}</div>
            ) : null}
            {pwSuccess ? (
              <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pwSuccess}
              </div>
            ) : null}
            <div className="sm:col-span-2 flex items-center justify-end">
              <button
                type="button"
                disabled={pwSaving}
                onClick={() => void onChangePassword()}
                className="rounded-2xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 hover:shadow-[#416B9F]/30 disabled:opacity-50"
              >
                {pwSaving ? 'Enregistrement…' : 'Changer le mot de passe'}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-2xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 hover:shadow-[#416B9F]/30 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

