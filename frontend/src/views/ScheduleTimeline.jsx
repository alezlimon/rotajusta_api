import { useEffect, useMemo, useState } from 'react'
import { logout } from '../services/authService'
import { generateMonthlySchedule, getScheduleBootstrap, moveScheduleAssignment } from '../services/scheduleService'
import { BlockConfigurator, GenerationToolbar, TimelineGrid, createBlockDraft, makeCellKey, toMonthLabel } from '../components'

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
})

const createMovePayload = (picked, employeeId, day) => ({
  from: { employeeId: picked.employeeId, day: picked.day },
  to: { employeeId, day },
})

const applyMove = (currentPlan, from, to) => {
  const fromKey = makeCellKey(from.employeeId, from.day)
  const toKey = makeCellKey(to.employeeId, to.day)
  const current = currentPlan[fromKey]
  if (!current || fromKey === toKey) return currentPlan
  return { ...currentPlan, [toKey]: { ...current, employeeId: to.employeeId, day: to.day }, [fromKey]: null }
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
  const [picked, setPicked] = useState(null)
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
    } catch (currentError) {
      setError(currentError.message || 'No se pudo generar la rota')
    }
  }

  const handlePick = (employeeId, day) => setPicked({ employeeId, day })

  const handleDrop = async (employeeId, day) => {
    if (!picked) return
    const payload = createMovePayload(picked, employeeId, day)
    const previousPlan = plan
    const optimisticPlan = applyMove(previousPlan, payload.from, payload.to)
    if (optimisticPlan === previousPlan) return

    setError('')
    setPlan(optimisticPlan)
    setPicked(null)

    try {
      await moveScheduleAssignment({ month, year, ...payload })
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

        <TimelineGrid employees={employees} days={days} blocks={blocks} plan={plan} onPick={handlePick} onDrop={handleDrop} />
      </section>
    </main>
  )
}
