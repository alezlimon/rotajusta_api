import { useEffect, useMemo, useState } from 'react'
import { logout } from '../services/authService'
import { generateMonthlySchedule, getScheduleBootstrap, moveScheduleAssignment } from '../services/scheduleService'
import { AuditPanel, BlockConfigurator, GenerationToolbar, StaffingAlertsPanel, TimelineGrid, createBlockDraft, makeCellKey, toMonthLabel } from '../components'
import { SCHEDULE_CONFIG } from '../constants/schedule'

const parseNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBlockId = (name) => `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

const compliancePercent = (audit) => {
  const slots = audit?.summary?.realism?.fullWeekSlots || 0
  if (!slots) return 0
  const respected = audit?.summary?.realism?.preferredBreaksRespected || 0
  return Math.round((respected / slots) * 100)
}

const healthTone = ({ coverage, alerts, compliance }) => {
  if (coverage.total && coverage.covered === coverage.total && alerts === 0 && compliance >= 85) {
    return { label: 'Rota saludable', className: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200' }
  }
  if (alerts <= 3 && compliance >= 70) {
    return { label: 'Riesgo medio', className: 'border-amber-300/30 bg-amber-500/10 text-amber-200' }
  }
  return { label: 'Rota forzada', className: 'border-rose-300/30 bg-rose-500/10 text-rose-200' }
}

const semaphoreTone = (label) => {
  if (label === 'ok') return 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
  if (label === 'warn') return 'border-amber-300/30 bg-amber-500/10 text-amber-200'
  return 'border-rose-300/30 bg-rose-500/10 text-rose-200'
}

const coverageSemaphore = (coverage, alerts) => {
  if (coverage.total && coverage.covered === coverage.total && alerts === 0) return { status: 'ok', text: 'Cobertura completa' }
  if (alerts <= 3) return { status: 'warn', text: 'Cobertura con riesgo leve' }
  return { status: 'risk', text: 'Cobertura en riesgo' }
}

const dispersionSemaphore = (points = 0) => {
  if (points < 20) return { status: 'ok', text: 'Dispersión baja' }
  if (points <= 40) return { status: 'warn', text: 'Dispersión media' }
  return { status: 'risk', text: 'Dispersión alta' }
}

const alertsSemaphore = (alerts = 0) => {
  if (alerts === 0) return { status: 'ok', text: 'Sin alertas críticas' }
  if (alerts <= 3) return { status: 'warn', text: 'Alertas controlables' }
  return { status: 'risk', text: 'Demasiadas alertas críticas' }
}

const VIEWS = {
  SUMMARY: 'summary',
  TIMELINE: 'timeline',
  ANALYTICS: 'analytics',
}

const viewClass = (active, value) =>
  active === value
    ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100'
    : 'border-white/15 bg-slate-950/60 text-slate-300 hover:border-cyan-300/40'

const toAssignmentsMap = (value) => {
  if (!value) return {}
  if (!Array.isArray(value)) return value
  return value.reduce((acc, assignment) => {
    if (!assignment) return acc
    const key = makeCellKey(assignment.employeeId, assignment.day)
    return { ...acc, [key]: assignment }
  }, {})
}

const normalizeEmployees = (employees) =>
  (employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name || employee.nombre || `Empleado ${employee.id}`,
  }))

const toBootstrapState = (payload) => ({
  employees: normalizeEmployees(payload.employees),
  blocks: payload.blocks || [],
  days: payload.days || [],
  plan: toAssignmentsMap(payload.assignments || payload.plan),
  audit: payload.audit || { summary: null, byEmployee: [] },
  alerts: payload.alerts || [],
})

const applyScheduleState = (state, setters) => {
  setters.setEmployees(state.employees)
  setters.setBlocks(state.blocks)
  setters.setDays(state.days)
  setters.setPlan(state.plan)
  setters.setAudit(state.audit)
  setters.setAlerts(state.alerts)
}

const createMovePayload = (picked, employeeId, day) => ({
  from: { employeeId: picked.employeeId, day: picked.day },
  to: { employeeId, day },
})

const toMinutes = (timeValue) => {
  const [hours, minutes] = timeValue.split(':').map(Number)
  return hours * 60 + minutes
}

const getBlockHours = (blocks, blockId) => {
  const block = blocks.find((item) => item.id === blockId)
  if (!block) return 0
  const start = toMinutes(block.start)
  const end = toMinutes(block.end)
  const minutes = end > start ? end - start : 1440 - start + end
  return minutes / 60
}

const validateHours = (blocks, assignment) =>
  getBlockHours(blocks, assignment.blockId) <= SCHEDULE_CONFIG.MAX_DAILY_HOURS

const getBlockById = (blocks, blockId) => blocks.find((item) => item.id === blockId)

const isNightBlock = (block) => {
  if (!block) return false
  const byName = (block.name || '').toLowerCase().includes('noche')
  const byTime = block.start === '00:00' && block.end === '08:00'
  return byName || byTime
}

const isMorningOrAfternoonBlock = (block) => {
  if (!block) return false
  const name = (block.name || '').toLowerCase()
  const byName = name.includes('manana') || name.includes('mañana') || name.includes('tarde')
  const byTime = (block.start === '08:00' && block.end === '16:00') || (block.start === '16:00' && block.end === '00:00')
  return byName || byTime
}

const getEmployeeAssignments = (plan, employeeId) =>
  Object.values(plan)
    .filter((assignment) => assignment && assignment.employeeId === employeeId)
    .sort((a, b) => a.day - b.day)

const validateRestByEmployee = (plan, employeeId, blocks) => {
  const assignments = getEmployeeAssignments(plan, employeeId)
  for (const current of assignments) {
    const next = assignments.find((item) => item.day === current.day + 1)
    if (!next) continue
    const currentBlock = getBlockById(blocks, current.blockId)
    const nextBlock = getBlockById(blocks, next.blockId)
    if (isNightBlock(currentBlock) && isMorningOrAfternoonBlock(nextBlock)) return false
  }
  return true
}

const validateRestHook = ({ plan, blocks, employeeIds }) =>
  employeeIds.every((employeeId) => validateRestByEmployee(plan, employeeId, blocks))

const validateDrop = ({ picked, target, plan, blocks }) => {
  if (!picked) return { allowed: false, reason: 'Selecciona un turno para arrastrar' }
  const fromKey = makeCellKey(picked.employeeId, picked.day)
  const toKey = makeCellKey(target.employeeId, target.day)
  if (fromKey === toKey) return { allowed: false, reason: 'El origen y destino son la misma celda' }
  const source = plan[fromKey]
  if (!source) return { allowed: false, reason: 'No hay turno en la celda de origen' }
  const targetAssignment = plan[toKey]
  if (!validateHours(blocks, source)) {
    return { allowed: false, reason: `Supera el limite diario de ${SCHEDULE_CONFIG.MAX_DAILY_HOURS}h` }
  }
  if (targetAssignment && !validateHours(blocks, targetAssignment)) {
    return { allowed: false, reason: `Supera el limite diario de ${SCHEDULE_CONFIG.MAX_DAILY_HOURS}h` }
  }
  const mode = targetAssignment ? 'swap' : 'move'
  const nextPlan = mode === 'swap'
    ? applySwap(plan, { employeeId: picked.employeeId, day: picked.day }, target)
    : applyMove(plan, { employeeId: picked.employeeId, day: picked.day }, target)
  const employeeIds = Array.from(new Set([picked.employeeId, target.employeeId]))
  const restOk = validateRestHook({ plan: nextPlan, blocks, employeeIds })
  if (!restOk) {
    return { allowed: false, reason: 'Violación de descanso: Mínimo 12h tras Noche' }
  }
  return { allowed: true, reason: '', mode }
}

const applyMove = (currentPlan, from, to) => {
  const fromKey = makeCellKey(from.employeeId, from.day)
  const toKey = makeCellKey(to.employeeId, to.day)
  const current = currentPlan[fromKey]
  if (!current || fromKey === toKey) return currentPlan
  return { ...currentPlan, [toKey]: { ...current, employeeId: to.employeeId, day: to.day }, [fromKey]: null }
}

const applySwap = (currentPlan, from, to) => {
  const fromKey = makeCellKey(from.employeeId, from.day)
  const toKey = makeCellKey(to.employeeId, to.day)
  const source = currentPlan[fromKey]
  const target = currentPlan[toKey]
  if (!source || !target || fromKey === toKey) return currentPlan
  return {
    ...currentPlan,
    [toKey]: { ...source, employeeId: to.employeeId, day: to.day },
    [fromKey]: { ...target, employeeId: from.employeeId, day: from.day },
  }
}

export function ScheduleTimeline({ user, onLogout }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [draft, setDraft] = useState(createBlockDraft)
  const [employees, setEmployees] = useState([])
  const [blocks, setBlocks] = useState([])
  const [days, setDays] = useState([])
  const [plan, setPlan] = useState({})
  const [audit, setAudit] = useState({ summary: null, byEmployee: [] })
  const [alerts, setAlerts] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [activeView, setActiveView] = useState(VIEWS.TIMELINE)
  const [picked, setPicked] = useState(null)
  const [hoverCell, setHoverCell] = useState(null)
  const [hoverReason, setHoverReason] = useState('')
  const [error, setError] = useState('')

  const monthLabel = useMemo(() => toMonthLabel(year, month), [year, month])
  const coverage = useMemo(() => {
    const total = days.length * blocks.length
    const covered = Object.values(plan).filter(Boolean).length
    return { covered, total }
  }, [days, blocks, plan])
  const compliance = useMemo(() => compliancePercent(audit), [audit])
  const health = useMemo(() => healthTone({ coverage, alerts: alerts.length, compliance }), [coverage, alerts, compliance])
  const dispersion = audit?.summary?.dispersionPoints || 0
  const fallback6x1 = audit?.summary?.realism?.fallback6x1Count || 0
  const coverageSem = useMemo(() => coverageSemaphore(coverage, alerts.length), [coverage, alerts])
  const dispersionSem = useMemo(() => dispersionSemaphore(dispersion), [dispersion])
  const alertsSem = useMemo(() => alertsSemaphore(alerts.length), [alerts])

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const payload = await getScheduleBootstrap({ month, year })
        const state = toBootstrapState(payload)
        applyScheduleState(state, { setEmployees, setBlocks, setDays, setPlan, setAudit, setAlerts })
        setRefreshKey((current) => current + 1)
      } catch (currentError) {
        setError(currentError.message || 'No se pudo cargar el timeline')
      }
    }

    loadBootstrap()
  }, [month, year])

  const handleDraftChange = (field, value) => setDraft((current) => ({ ...current, [field]: value }))

  const handleAddBlock = () => {
    if (!draft.name.trim()) return
    const newBlock = { ...draft, id: toBlockId(draft.name) }
    setBlocks((current) => [...current, newBlock])
    setDraft(createBlockDraft())
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      setError('')
      await generateMonthlySchedule({ month, year, blocks })
      const refreshed = await getScheduleBootstrap({ month, year })
      const state = toBootstrapState(refreshed)
      applyScheduleState(state, { setEmployees, setBlocks, setDays, setPlan, setAudit, setAlerts })
      setRefreshKey((current) => current + 1)
    } catch (currentError) {
      setError(currentError.message || 'No se pudo generar la rota')
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePick = (employeeId, day) => setPicked({ employeeId, day })

  const canDropTo = (employeeId, day) =>
    validateDrop({ picked, target: { employeeId, day }, plan, blocks })

  const handleHover = (employeeId, day) => {
    if (!employeeId || !day) {
      setHoverCell(null)
      setHoverReason('')
      return
    }
    const dropState = canDropTo(employeeId, day)
    setHoverCell({ employeeId, day })
    setHoverReason(dropState.allowed ? '' : dropState.reason)
  }

  const handleInvalidDrop = (reason) => {
    setError(reason || 'Movimiento no permitido')
    setHoverCell(null)
    setHoverReason('')
  }

  const handleDrop = async (employeeId, day) => {
    if (!picked) return
    const payload = createMovePayload(picked, employeeId, day)
    const dropState = canDropTo(employeeId, day)
    if (!dropState.allowed) return handleInvalidDrop(dropState.reason)
    const previousPlan = plan
    const optimisticPlan = dropState.mode === 'swap'
      ? applySwap(previousPlan, payload.from, payload.to)
      : applyMove(previousPlan, payload.from, payload.to)
    if (optimisticPlan === previousPlan) return

    setError('')
    setPlan(optimisticPlan)
    setHoverCell(null)
    setHoverReason('')
    setPicked(null)

    try {
      await moveScheduleAssignment({ month, year, ...payload, mode: dropState.mode })
      const refreshed = await getScheduleBootstrap({ month, year })
      const refreshedState = toBootstrapState(refreshed)
      applyScheduleState(refreshedState, { setEmployees, setBlocks, setDays, setPlan, setAudit, setAlerts })
    } catch (currentError) {
      setPlan(previousPlan)
      setError(currentError.message || 'No se pudo guardar el movimiento')
    }
  }

  const handleLogout = () => {
    logout()
    onLogout?.()
  }

  const closeAnalytics = () => setAnalyticsOpen(false)

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <section className="mx-auto w-full max-w-[1600px] space-y-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">La Rota Justa</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Schedule Timeline</h1>
            <p className="mt-1 text-sm text-slate-400">Manager: {user?.nombre || 'Manager'}</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Cerrar sesion</button>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Cobertura</p>
            <p className="mt-1 text-2xl font-semibold text-white">{coverage.covered} / {coverage.total}</p>
            <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${health.className}`}>
              {health.label}
            </span>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dispersión</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">{dispersion}</p>
            <p className="mt-2 text-xs text-slate-300">{dispersionSem.text}</p>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Alertas críticas</p>
            <p className="mt-1 text-2xl font-semibold text-rose-200">{alerts.length}</p>
            <p className="mt-2 text-xs text-slate-300">{alertsSem.text}</p>
          </article>
        </section>

        <section className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-200">
            Regla de calidad: máximo {SCHEDULE_CONFIG.MAX_6X1_EXCEPTIONS_PER_EMPLOYEE_MONTH} excepción 6+1 por empleado/mes.
            Actual mes: {fallback6x1} fallback(s) detectados.
          </p>
        </section>

        <nav className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-2">
          <button
            type="button"
            onClick={() => setActiveView(VIEWS.SUMMARY)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${viewClass(activeView, VIEWS.SUMMARY)}`}
          >
            Resumen
          </button>
          <button
            type="button"
            onClick={() => setActiveView(VIEWS.TIMELINE)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${viewClass(activeView, VIEWS.TIMELINE)}`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveView(VIEWS.ANALYTICS)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${viewClass(activeView, VIEWS.ANALYTICS)}`}
          >
            Alertas y Analítica
          </button>
        </nav>

        {error ? <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p> : null}

        {activeView === VIEWS.SUMMARY ? (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <GenerationToolbar
                month={month}
                year={year}
                monthLabel={monthLabel}
                onMonth={(value) => setMonth(parseNumber(value, month))}
                onYear={(value) => setYear(parseNumber(value, year))}
                onGenerate={handleGenerate}
                coverage={coverage}
                isGenerating={isGenerating}
              />
              <StaffingAlertsPanel alerts={alerts} compact={false} />
            </div>
            <AuditPanel audit={audit} compact={false} />
          </section>
        ) : null}

        {activeView === VIEWS.TIMELINE ? (
          <section className="min-w-0 space-y-5">
            <BlockConfigurator blocks={blocks} draft={draft} onDraftChange={handleDraftChange} onAdd={handleAddBlock} />
            <GenerationToolbar
              month={month}
              year={year}
              monthLabel={monthLabel}
              onMonth={(value) => setMonth(parseNumber(value, month))}
              onYear={(value) => setYear(parseNumber(value, year))}
              onGenerate={handleGenerate}
              coverage={coverage}
              isGenerating={isGenerating}
            />
            <TimelineGrid
              key={`timeline-${refreshKey}-${month}-${year}`}
              employees={employees}
              days={days}
              blocks={blocks}
              plan={plan}
              picked={picked}
              hoverCell={hoverCell}
              canDropTo={canDropTo}
              onPick={handlePick}
              onDrop={handleDrop}
              onHover={handleHover}
              onInvalidDrop={handleInvalidDrop}
              hoverReason={hoverReason}
              alerts={alerts}
              month={month}
              year={year}
            />
          </section>
        ) : null}

        {activeView === VIEWS.ANALYTICS ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Analítica resumida por semáforos</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <article className={`rounded-xl border px-3 py-3 ${semaphoreTone(coverageSem.status)}`}>
                <p className="text-xs uppercase tracking-[0.2em]">Cobertura</p>
                <p className="mt-1 text-sm font-semibold">{coverageSem.text}</p>
              </article>
              <article className={`rounded-xl border px-3 py-3 ${semaphoreTone(dispersionSem.status)}`}>
                <p className="text-xs uppercase tracking-[0.2em]">Dispersión</p>
                <p className="mt-1 text-sm font-semibold">{dispersionSem.text}</p>
              </article>
              <article className={`rounded-xl border px-3 py-3 ${semaphoreTone(alertsSem.status)}`}>
                <p className="text-xs uppercase tracking-[0.2em]">Alertas</p>
                <p className="mt-1 text-sm font-semibold">{alertsSem.text}</p>
              </article>
            </div>
            <AuditPanel audit={audit} compact />
            <StaffingAlertsPanel alerts={alerts} compact />
          </section>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => setAnalyticsOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-cyan-300/30 bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl lg:hidden"
      >
        Ver analiticas
      </button>

      {analyticsOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/70 lg:hidden" onClick={closeAnalytics}>
          <aside
            className="absolute right-0 top-0 h-full w-[92vw] max-w-sm space-y-4 overflow-y-auto border-l border-white/10 bg-slate-900 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Analiticas</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeAnalytics} className="rounded-lg border border-white/20 px-2 py-1 text-xs text-slate-200">Cerrar</button>
              </div>
            </div>
            <AuditPanel audit={audit} compact />
            <StaffingAlertsPanel alerts={alerts} compact />
          </aside>
        </div>
      ) : null}
    </main>
  )
}
