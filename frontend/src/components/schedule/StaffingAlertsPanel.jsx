const byWeek = (alerts) =>
  alerts.reduce((acc, alert) => ({ ...acc, [alert.weekKey]: (acc[alert.weekKey] || 0) + 1 }), {})

const byDay = (alerts) =>
  alerts.reduce((acc, alert) => ({ ...acc, [alert.day]: (acc[alert.day] || 0) + 1 }), {})

const byReason = (alerts) =>
  alerts.reduce((acc, alert) => ({ ...acc, [alert.reason]: (acc[alert.reason] || 0) + 1 }), {})

const asSortedEntries = (mapLike) =>
  Object.entries(mapLike).sort((a, b) => String(a[0]).localeCompare(String(b[0])))

const reasonLabel = (reason) => {
  if (reason === 'WEEKLY_CONSTRAINT') return 'Límite semanal alcanzado'
  if (reason === 'NO_EMPLOYEE_AVAILABLE') return 'Sin personal disponible'
  return reason
}

const reasonAction = (reason) => {
  if (reason === 'WEEKLY_CONSTRAINT') return 'Acción: permitir excepción puntual 6+1 en esa semana.'
  if (reason === 'NO_EMPLOYEE_AVAILABLE') return 'Acción: mover bloque de menor impacto o abrir vacante temporal.'
  return 'Acción: revisar cobertura manualmente en timeline.'
}

const topActionableDays = (alerts) =>
  asSortedEntries(byDay(alerts)).sort((a, b) => b[1] - a[1]).slice(0, 4)

const dominantReasonByDay = (alerts, day) => {
  const dayAlerts = alerts.filter((item) => String(item.day) === String(day))
  const buckets = dayAlerts.reduce((acc, alert) => ({ ...acc, [alert.reason]: (acc[alert.reason] || 0) + 1 }), {})
  return Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NO_EMPLOYEE_AVAILABLE'
}

export function StaffingAlertsPanel({ alerts, compact = false }) {
  if (!alerts?.length) return null

  const weekBuckets = asSortedEntries(byWeek(alerts))
  const dayBuckets = asSortedEntries(byDay(alerts))
  const reasonBuckets = asSortedEntries(byReason(alerts))
  const actionable = topActionableDays(alerts)

  if (compact) {
    return (
      <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-rose-100">Incidencias</h2>
          <span className="rounded-full border border-rose-400/30 bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-200">
            {alerts.length} sin asignar
          </span>
        </div>

        <ul className="mt-3 space-y-1 text-xs text-slate-200">
          {actionable.map(([day, total]) => {
            const reason = dominantReasonByDay(alerts, day)
            return (
            <li key={`compact-${day}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1">
              <span>Día {day}: {reasonLabel(reason)}</span>
              <span className="font-semibold text-rose-200">{total}</span>
            </li>
            )
          })}
        </ul>

        <p className="mt-3 text-xs text-slate-300">Semanas con alertas: {weekBuckets.length}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-rose-100">Incidencias accionables</h2>
        <span className="rounded-full border border-rose-400/30 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
          {alerts.length} bloques sin asignar
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prioridad del manager</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {actionable.map(([day, total]) => {
              const reason = dominantReasonByDay(alerts, day)
              return (
                <li key={`act-${day}`} className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2">
                  <p className="font-semibold text-rose-200">Día {day}: {total} hueco(s)</p>
                  <p className="text-xs text-slate-300">{reasonLabel(reason)}</p>
                  <p className="mt-1 text-xs text-cyan-200">{reasonAction(reason)}</p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Por semana</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {weekBuckets.map(([weekKey, total]) => <li key={weekKey}>{weekKey}: {total}</li>)}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Por dia</p>
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1 text-sm text-slate-200">
            {dayBuckets.map(([day, total]) => <li key={day}>Dia {day}: {total}</li>)}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Motivo</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {reasonBuckets.map(([reason, total]) => <li key={reason}>{reasonLabel(reason)}: {total}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
