export function GenerationToolbar({ month, year, monthLabel, onMonth, onYear, onGenerate, coverage, isGenerating = false }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold text-white">Generacion mensual</h2>
      <p className="mt-1 text-sm text-slate-400">Selecciona periodo y genera la rota automatica para el equipo.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm text-slate-300">Mes<input type="number" min="1" max="12" value={month} onChange={(event) => onMonth(Number(event.target.value || 1))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" /></label>
        <label className="grid gap-1 text-sm text-slate-300">Ano<input type="number" min="2024" max="2099" value={year} onChange={(event) => onYear(Number(event.target.value || 2026))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" /></label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-emerald-300/60"
        >
          {isGenerating ? 'Generando...' : 'Generar Rota Automatica'}
        </button>
        <p className="text-sm text-cyan-200">Periodo: {monthLabel}</p>
        {coverage ? (
          <p className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            Cobertura: {coverage.covered} / {coverage.total} cubiertos
          </p>
        ) : null}
      </div>
    </section>
  )
}
