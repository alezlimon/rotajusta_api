const SEMAPHORE_STYLES = {
  high: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  low: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  neutral: 'border-slate-400/40 bg-slate-500/15 text-slate-200',
}

const OVERLOAD_STYLES = {
  OK: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  'Horas Extra': 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  Sobrecarga: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
}

const normalizeAudit = (audit) => {
  if (Array.isArray(audit)) {
    return {
      summary: {
        fairnessLevel: 'neutral',
        fairnessLabel: 'Sin semaforo',
        dispersionPoints: 0,
        limits: {
          fairnessHighMaxDiff: 20,
          fairnessMediumMaxDiff: 40,
          weeklyHoursLimit: 40,
          monthlyHoursLimit: 160,
        },
      },
      byEmployee: audit,
    }
  }
  return {
    summary: audit?.summary || {
      fairnessLevel: 'neutral',
      fairnessLabel: 'Sin semaforo',
      dispersionPoints: 0,
      limits: {
        fairnessHighMaxDiff: 20,
        fairnessMediumMaxDiff: 40,
        weeklyHoursLimit: 40,
        monthlyHoursLimit: 160,
      },
    },
    byEmployee: audit?.byEmployee || [],
  }
}

const toHours = (value) => (Number.isFinite(value) ? value.toFixed(1) : '0.0')

const overloadClass = (label) => OVERLOAD_STYLES[label] || OVERLOAD_STYLES.OK

export function AuditPanel({ audit }) {
  const normalized = normalizeAudit(audit)
  if (!normalized.byEmployee.length) return null

  const fairnessClass = SEMAPHORE_STYLES[normalized.summary.fairnessLevel] || SEMAPHORE_STYLES.neutral
  const limits = normalized.summary.limits || {}

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Auditoria del generador</h2>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${fairnessClass}`}>
            {normalized.summary.fairnessLabel}
          </span>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Dispersion {normalized.summary.dispersionPoints} pts</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/70">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Puntos</th>
              <th className="px-4 py-3">Trabajados</th>
              <th className="px-4 py-3">Libres</th>
              <th className="px-4 py-3">Noches</th>
              <th className="px-4 py-3">Horas mes</th>
              <th className="px-4 py-3">Pico semanal</th>
              <th className="px-4 py-3">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {normalized.byEmployee.map((row) => (
              <tr key={row.employeeId} className="hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white">{row.employeeName}</td>
                <td className="px-4 py-3 text-cyan-200">{row.totalPoints}</td>
                <td className="px-4 py-3">{row.workedDays}</td>
                <td className="px-4 py-3 text-emerald-300">{row.freeDays}</td>
                <td className="px-4 py-3 text-indigo-300">{row.nightShifts}</td>
                <td className="px-4 py-3">{toHours(row.totalHours)}h</td>
                <td className="px-4 py-3">{toHours(row.peakWeeklyHours)}h</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${overloadClass(row.overloadLabel)}`}>
                    {row.overloadLabel || 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1">
          Alta: &lt; {limits.fairnessHighMaxDiff} pts
        </span>
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1">
          Media: {limits.fairnessHighMaxDiff}-{limits.fairnessMediumMaxDiff} pts
        </span>
        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1">
          Desequilibrio: &gt; {limits.fairnessMediumMaxDiff} pts
        </span>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1">
          Limites: {limits.weeklyHoursLimit}h/semana · {limits.monthlyHoursLimit}h/mes
        </span>
      </div>
    </section>
  )
}
