export function BlockConfigurator({ blocks, draft, onDraftChange, onAdd }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold text-white">Bloques base</h2>
      <p className="mt-1 text-sm text-slate-400">Define turnos tipo con nombre, horas y color visual.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {blocks.map((block) => (
          <article key={block.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
            <div className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${block.color}`}>{block.name}</div>
            <p className="mt-2 text-sm text-slate-300">{block.start} - {block.end}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <input value={draft.name} onChange={(event) => onDraftChange('name', event.target.value)} placeholder="Nombre" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <input type="time" value={draft.start} onChange={(event) => onDraftChange('start', event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <input type="time" value={draft.end} onChange={(event) => onDraftChange('end', event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <button type="button" onClick={onAdd} className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950">Agregar bloque</button>
      </div>
    </section>
  )
}
