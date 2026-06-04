import { FirstLoginPasswordForm } from '@/components/auth/FirstLoginPasswordForm';

type Props = Readonly<{
  open: boolean;
  defaultCurrentPassword?: string;
  onSuccess: () => void;
  onUseOtherAccount: () => void;
}>;

/** Modale bloquante sur la page de connexion (première connexion propriétaire). */
export function OwnerFirstLoginPasswordModal({
  open,
  defaultCurrentPassword,
  onSuccess,
  onUseOtherAccount,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]" aria-hidden />
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-200/90 bg-white shadow-2xl shadow-zinc-900/15"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-first-login-title"
      >
        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-8">
          <h2 id="owner-first-login-title" className="text-xl font-bold tracking-tight text-zinc-900">
            Nouveau mot de passe
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Espace propriétaire — Bleu Calanque</p>
          <div className="mt-7">
            <FirstLoginPasswordForm
              defaultCurrentPassword={defaultCurrentPassword}
              onSuccess={onSuccess}
              onUseOtherAccount={onUseOtherAccount}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
