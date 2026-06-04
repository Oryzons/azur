/** Vignette bateau (photo principale ou placeholder). */
export function BoatCoverAvatar(props: Readonly<{ url?: string | null }>) {
  const base = 'h-9 w-9 shrink-0 rounded-2xl border border-zinc-200 shadow-sm';
  if (props.url) {
    return <img src={props.url} alt="" className={`${base} bg-zinc-100 object-cover`} />;
  }
  return <div className={`${base} bg-white`} aria-hidden />;
}
