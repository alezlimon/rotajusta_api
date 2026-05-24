import { useEffect, useMemo, useState } from 'react'
import { logout } from '../services/authService'
import { generateMonthlySchedule, getScheduleBootstrap, moveScheduleAssignment } from '../services/scheduleService'
import { AuditPanel, BlockConfigurator, GenerationToolbar, TimelineGrid, createBlockDraft, makeCellKey, toMonthLabel } from '../components'
import { SCHEDULE_CONFIG } from '../constants/schedule'

const parseNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBlockId = (name) => `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

const toBootstrapState = (payload) => ({
  employees: payload.employees || [],
  blocks: payload.blocks || [],
  days: payload.days || [],
  plan: payload.assignments || {},
  audit: payload.audit || { summary: null, byEmployee: [] },
})

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
  const [picked, setPicked] = useState(null)
  const [hoverCell, setHoverCell] = useState(null)
  const [hoverReason, setHoverReason] = useState('')
  const [error, setError] = useState('')

  const monthLabel = useMemo(() => toMonthLabel(year, month), [year, month])

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const payload = await getScheduleBootstrap({ month, year })
        const state = toBootstrapState(payload)
        setEmployees(state.employees)
        setBlocks(state.blocks)
        setDays(state.days)
        setPlan(state.plan)
        setAudit(state.audit)
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
    try {
      const payload = await generateMonthlySchedule({ month, year, blocks })
      const state = toBootstrapState(payload)
      setEmployees(state.employees)
      setBlocks(state.blocks)
      setDays(state.days)
      setPlan(state.plan)
      setAudit(state.audit)
    } catch (currentError) {
      setError(currentError.message || 'No se pudo generar la rota')
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
    } catch (currentError) {
      setPlan(previousPlan)
      setError(currentError.message || 'No se pudo guardar el movimiento')
    }
  }

  const handleLogout = () => {
    logout()
    onLogout?.()
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <section className="mx-auto w-full max-w-7xl space-y-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">La Rota Justa</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Schedule Timeline</h1>
            <p className="mt-1 text-sm text-slate-400">Manager: {user?.nombre || 'Manager'}</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Cerrar sesion</button>
        </header>

        {error ? <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p> : null}

        <BlockConfigurator blocks={blocks} draft={draft} onDraftChange={handleDraftChange} onAdd={handleAddBlock} />

        <GenerationToolbar
          month={month}
          year={year}
          monthLabel={monthLabel}
          onMonth={(value) => setMonth(parseNumber(value, month))}
          onYear={(value) => setYear(parseNumber(value, year))}
          onGenerate={handleGenerate}
        />

        <AuditPanel audit={audit} />

        <TimelineGrid
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
        />
      </section>
    </main>
  )
}
