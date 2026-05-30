import { useEffect, useState } from 'react'
import { getEmployeeProfile } from '../../services/authService'

const formatDate = (value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

const formatHours = (turn) => `${turn.hora_inicio.slice(0, 5)} - ${turn.hora_fin.slice(0, 5)}`

export function EmployeeProfileModal({ isOpen, employee, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !employee?.id) return
    const loadProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getEmployeeProfile(employee.id)
        setProfile(data)
      } catch (currentError) {
        setError(currentError.message || 'No se pudo cargar el perfil')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [isOpen, employee?.id])

  if (!isOpen || !employee) return null

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Perfil de empleado</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{employee.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{employee.email || 'Sin email'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">Cerrar</button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-400">Cargando perfil...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {profile ? (
          <>
            <section className="mt-4 grid gap-3 md:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rol</p>
                <p className="mt-2 text-lg font-semibold text-white">{profile.employee.role}</p>
                <p className="mt-1 text-sm text-slate-400">Saldo actual: {profile.employee.saldo_puntos_actual} puntos</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resumen reciente</p>
                <p className="mt-2 text-lg font-semibold text-white">{profile.summary.recent_points} puntos</p>
                <p className="mt-1 text-sm text-slate-400">{profile.summary.recent_hours} horas · {profile.summary.recent_turns} turnos · {profile.summary.recent_days} días</p>
              </article>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Últimos turnos</h4>
              <div className="mt-3 space-y-2">
                {profile.recent_turns.length ? profile.recent_turns.map((turn) => (
                  <article key={`${turn.fecha}-${turn.hora_inicio}`} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{formatDate(turn.fecha)}</p>
                        <p className="text-xs text-slate-400">{formatHours(turn)} · {turn.es_festivo ? 'Festivo' : 'Laborable'}</p>
                      </div>
                    </div>
                  </article>
                )) : <p className="text-sm text-slate-400">Sin turnos recientes.</p>}
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Historial reciente</h4>
              <div className="mt-3 space-y-2">
                {profile.recent_history.length ? profile.recent_history.map((item) => (
                  <article key={item.fecha} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span>{formatDate(item.fecha)}</span>
                      <span className="font-semibold text-white">{item.puntos_totales} pts</span>
                    </div>
                  </article>
                )) : <p className="text-sm text-slate-400">Sin historial reciente.</p>}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}