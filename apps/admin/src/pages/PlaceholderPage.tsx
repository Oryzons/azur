export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="max-w-3xl space-y-2">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      <p className="text-[15px] text-zinc-500">Cette section sera développée prochainement.</p>
    </div>
  );
}
