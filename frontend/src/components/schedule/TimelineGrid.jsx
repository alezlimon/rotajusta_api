import { makeCellKey } from './helpers'
import { SCHEDULE_CONFIG } from '../../constants/schedule'

const BLOCK_STYLES = {
  morning: 'bg-sky-400 text-slate-950',
  afternoon: 'bg-amber-400 text-slate-950',
  night: 'bg-indigo-400 text-slate-950',
}

const renderBlockPill = (assignment, blocks) => {
  if (!assignment) return null
  const block = blocks.find((item) => item.id === assignment.blockId)
  if (!block) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300/50 bg-amber-500/10 px-2 py-2 text-xs font-semibold text-amber-200">
        <p>Bloque no disponible</p>
        <p className="opacity-80">{assignment.blockId}</p>
      </div>
    )
  }
  const tone = BLOCK_STYLES[block.id] || block.color || 'bg-cyan-300 text-slate-950'
  return (
    <div className={`rounded-xl px-2 py-2 text-xs font-semibold ${tone}`}>
      <p>{block.name}</p>
      <p className="opacity-80">{block.start} - {block.end}</p>
    </div>
  )
}

const renderVacancyPill = (count) => {
  if (!count) return null
  return (
    <div className="rounded-xl border border-dashed border-slate-500/70 bg-slate-900/40 px-2 py-2 text-xs font-semibold text-slate-300">
      <p>Vacante</p>
      <p className="opacity-80">{count > 1 ? `x${count} sin cubrir` : 'sin cubrir'}</p>
    </div>
  )
}

const alertsByDay = (alerts) =>
  (alerts || []).reduce((acc, alert) => ({ ...acc, [alert.day]: (acc[alert.day] || 0) + 1 }), {})

const isHoveredCell = (hoverCell, employeeId, day) =>
  hoverCell?.employeeId === employeeId && hoverCell?.day === day

const getCellClassName = (isHovered, isAllowed, isDragging) => {
  const base = 'min-h-16 border-l border-white/5 p-1 transition-colors'
  if (!isDragging) return base
  if (!isHovered) return `${base} cursor-grab`
  return isAllowed
    ? `${base} cursor-copy border-cyan-300/60 bg-cyan-400/10`
    : `${base} cursor-not-allowed border-red-300/60 bg-red-400/10`
}

export function TimelineGrid({
  employees,
  days,
  blocks,
  plan,
  picked,
  hoverCell,
  canDropTo,
  onPick,
  onDrop,
  onHover,
  onInvalidDrop,
  hoverReason,
  alerts,
}) {
  const minWidth = `${days.length * SCHEDULE_CONFIG.DAY_CELL_WIDTH + 220}px`
  const template = `220px repeat(${days.length}, minmax(${SCHEDULE_CONFIG.DAY_CELL_WIDTH}px, 1fr))`
  const isDragging = Boolean(picked)
  const unassignedByDay = alertsByDay(alerts)

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold text-white">Timeline del manager</h2>
      <p className="mt-1 text-sm text-slate-400">Arrastra pastillas entre celdas para reajustar la rota.</p>

      <div className="mt-4 overflow-x-auto">
        <div style={{ minWidth }}>
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-30 border-r border-white/10 bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
              {SCHEDULE_CONFIG.TEAM_NAME}
            </div>
            {days.map((day) => <div key={`head-${day}`} className="px-2 py-2 text-center text-xs font-semibold text-cyan-200">{day}</div>)}
          </div>

          {employees.map((employee) => (
            <div key={employee.id} className="grid border-b border-white/5" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-20 border-r border-white/10 bg-slate-900 px-3 py-3 text-sm font-medium text-white shadow-[6px_0_14px_rgba(2,6,23,0.35)]">
                {employee.name}
              </div>
              {days.map((day) => {
                const assignment = plan[makeCellKey(employee.id, day)]
                const dropState = canDropTo(employee.id, day)
                const hovered = isHoveredCell(hoverCell, employee.id, day)
                const cellClassName = getCellClassName(hovered, dropState.allowed, isDragging)
                const vacancyCount = !assignment && employee.id === employees[0]?.id ? (unassignedByDay[day] || 0) : 0
                return (
                  <div
                    key={`${employee.id}-${day}`}
                    className={`${cellClassName} relative`}
                    onDragLeave={() => onHover(null, null)}
                    onDragOver={(event) => {
                      onHover(employee.id, day)
                      if (!dropState.allowed) {
                        event.dataTransfer.dropEffect = 'none'
                        return
                      }
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event) => {
                      onHover(null, null)
                      if (!dropState.allowed) {
                        event.preventDefault()
                        onInvalidDrop(dropState.reason)
                        return
                      }
                      onDrop(employee.id, day)
                    }}
                  >
                    <div draggable={Boolean(assignment)} onDragStart={() => onPick(employee.id, day)}>
                      {renderBlockPill(assignment, blocks)}
                      {renderVacancyPill(vacancyCount)}
                    </div>
                    {isDragging && hovered && !dropState.allowed && hoverReason ? (
                      <div className="pointer-events-none absolute left-1 top-1 z-40 max-w-[220px] rounded-lg border border-red-300/40 bg-slate-900/95 px-2 py-1 text-xs text-red-200 shadow-lg">
                        {hoverReason}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
