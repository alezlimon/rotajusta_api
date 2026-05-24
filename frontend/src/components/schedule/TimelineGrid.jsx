import { makeCellKey } from './helpers'
import { SCHEDULE_CONFIG } from '../../constants/schedule'

const renderBlockPill = (assignment, blocks) => {
  if (!assignment) return null
  const block = blocks.find((item) => item.id === assignment.blockId)
  if (!block) return null
  return (
    <div className={`rounded-xl px-2 py-2 text-xs font-semibold ${block.color}`}>
      <p>{block.name}</p>
      <p className="opacity-80">{block.start} - {block.end}</p>
    </div>
  )
}

export function TimelineGrid({ employees, days, blocks, plan, onPick, onDrop }) {
  const minWidth = `${days.length * SCHEDULE_CONFIG.DAY_CELL_WIDTH + 220}px`
  const template = `220px repeat(${days.length}, minmax(${SCHEDULE_CONFIG.DAY_CELL_WIDTH}px, 1fr))`

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
                return (
                  <div key={`${employee.id}-${day}`} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(employee.id, day)} className="min-h-16 border-l border-white/5 p-1">
                    <div draggable={Boolean(assignment)} onDragStart={() => onPick(employee.id, day)}>
                      {renderBlockPill(assignment, blocks)}
                    </div>
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
