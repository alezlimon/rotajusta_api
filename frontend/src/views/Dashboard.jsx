import { useEffect, useState } from 'react'
import { validarJornada } from '../services/turnosService'
import { getCurrentUser, getEmployees, logout } from '../services/authService'

const createTurno = (hora_inicio = '', hora_fin = '') => ({ hora_inicio, hora_fin })

const createValidationForm = () => ({
  empleado_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  es_festivo: false,
  turnos: [createTurno('09:00', '13:00'), createTurno('16:00', '20:00')],
})

const updateTurnoAt = (turnos, index, field, value) =>
  turnos.map((turno, currentIndex) => (currentIndex === index ? { ...turno, [field]: value } : turno))

const removeTurnoAt = (turnos, index) => turnos.filter((_, currentIndex) => currentIndex !== index)

const getDaySummaries = (result) => {
  const summaries = (result.desglose?.turnos || []).reduce((acc, turno) => {
    turno.bloques.forEach((bloque) => {
      const current = acc[bloque.fecha] || {
        fecha: bloque.fecha,
        puntos: 0,
        es_festivo: Boolean(bloque.es_festivo),
        multiplicador_dia: bloque.multiplicador_dia,
      }
      current.puntos += bloque.franjas.reduce((sum, franja) => sum + franja.puntos, 0)
      current.es_festivo = current.es_festivo || Boolean(bloque.es_festivo)
      current.multiplicador_dia = bloque.multiplicador_dia
      acc[bloque.fecha] = current
    })
    return acc
  }, {})

  return Object.values(summaries).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

const getFranjaRows = (result) =>
  (result.desglose?.turnos || []).flatMap((turno) =>
    turno.bloques.flatMap((bloque) =>
      bloque.franjas.map((franja) => ({
        fecha: bloque.fecha,
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
        franja: franja.franja,
        horas: franja.horas,
        multiplicador_franja: franja.multiplicador_franja,
        multiplicador_dia: franja.multiplicador_dia,
        puntos: franja.puntos,
      }))
    )
  )

export function Dashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(user)
  const [error, setError] = useState('')
  const [form, setForm] = useState(createValidationForm)
  const [employees, setEmployees] = useState([])
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [employeesError, setEmployeesError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getCurrentUser()
        setProfile(response.user)
      } catch (currentError) {
        setError(currentError.message || 'No se pudo cargar el perfil')
      }
    }

    loadProfile()
  }, [])

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await getEmployees()
        setEmployees(response.employees || [])
        setForm((current) => ({
          ...current,
          empleado_id: current.empleado_id || String(response.employees?.[0]?.id || ''),
        }))
      } catch (currentError) {
        setEmployeesError(currentError.message || 'No se pudo cargar la lista de empleados')
      }
    }

    loadEmployees()
  }, [])

  const setFormValue = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
  }

  const setTurnoValue = (index, field, value) => {
    setForm((current) => ({ ...current, turnos: updateTurnoAt(current.turnos, index, field, value) }))
  }

  const addTurno = () => {
    setForm((current) => ({ ...current, turnos: [...current.turnos, createTurno()] }))
  }

  const deleteTurno = (index) => {
    setForm((current) => ({ ...current, turnos: removeTurnoAt(current.turnos, index) }))
  }

  const buildPayload = () => ({
    empleado_id: Number(form.empleado_id),
    fecha: form.fecha,
    es_festivo: form.es_festivo,
    turnos: form.turnos,
  })

  const submitValidation = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')
    setResult(null)

    try {
      const response = await validarJornada(buildPayload())
      setResult(response)
    } catch (currentError) {
      setSubmitError(currentError.message || 'No se pudo validar la jornada')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    onLogout?.()
  }

  const daySummaries = result ? getDaySummaries(result) : []
  const franjaRows = result ? getFranjaRows(result) : []

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">La Rota Justa</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Dashboard inicial</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Bienvenido{profile?.nombre ? `, ${profile.nombre}` : ''}. Esta es la primera base visual del monorepo para gestionar turnos y puntos.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Sesión</span>
            <p className="mt-3 text-lg font-medium text-white">Autenticado</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Rol</span>
            <p className="mt-3 text-lg font-medium text-white">{profile?.role || 'MANAGER'}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Estado</span>
            <p className="mt-3 text-lg font-medium text-white">Listo para construir módulos</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Puntos</span>
            <p className="mt-3 text-lg font-medium text-white">{profile?.saldo_puntos_actual ?? 0}</p>
          </article>
        </div>

        <section className="mt-8 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Validación</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Validar jornada desde backend</h2>
            </div>
            <p className="max-w-2xl text-sm text-slate-400">
              Introduce el empleado, la fecha y los turnos. El formulario llama al endpoint protegido del backend y devuelve los puntos calculados.
            </p>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submitValidation}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Empleado
                <select
                  value={form.empleado_id}
                  onChange={(event) => setFormValue('empleado_id', event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="">Selecciona un empleado</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.nombre} - {employee.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Fecha
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(event) => setFormValue('fecha', event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.es_festivo}
                  onChange={(event) => setFormValue('es_festivo', event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                />
                Marcar como festivo
              </label>
            </div>

            {employeesError && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {employeesError}
              </p>
            )}

            <div className="grid gap-4">
              {form.turnos.map((turno, index) => (
                <div key={`${index}-${turno.hora_inicio}-${turno.hora_fin}`} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-2 text-sm text-slate-300">
                    Hora inicio
                    <input
                      type="time"
                      value={turno.hora_inicio}
                      onChange={(event) => setTurnoValue(index, 'hora_inicio', event.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-300">
                    Hora fin
                    <input
                      type="time"
                      value={turno.hora_fin}
                      onChange={(event) => setTurnoValue(index, 'hora_fin', event.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => deleteTurno(index)}
                      disabled={form.turnos.length === 1}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addTurno}
                className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              >
                Añadir turno
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Validando...' : 'Validar jornada'}
              </button>
            </div>
          </form>

          {submitError && (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {submitError}
            </p>
          )}

          {result && (
            <div className="mt-4 grid gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <p>Empleado: {result.empleado_id}</p>
                <p>Fecha: {result.fecha}</p>
                <p>Puntos: {result.puntos_calculados}</p>
                <p>Turnos: {result.turnos_procesados}</p>
                <p>Turno partido: {result.es_turno_partido ? 'Sí' : 'No'}</p>
                <p>Bonus: {result.desglose?.bonus_turno_partido || 0}</p>
              </div>

              {daySummaries.length ? (
                <section className="grid gap-3">
                  <h3 className="text-base font-semibold text-white">Totales por día</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {daySummaries.map((day) => (
                      <article key={day.fecha} className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{day.fecha}</p>
                          <p className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
                            x{day.multiplicador_dia}
                          </p>
                        </div>
                        <p className="mt-3 text-3xl font-semibold text-emerald-300">{Math.round(day.puntos)}</p>
                        <p className="mt-2 text-slate-300">{day.es_festivo ? 'Festivo' : 'Laborable'}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {franjaRows.length ? (
                <section className="grid gap-3">
                  <h3 className="text-base font-semibold text-white">Tabla compacta de franjas</h3>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                      <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.2em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Turno</th>
                          <th className="px-4 py-3">Franja</th>
                          <th className="px-4 py-3">Horas</th>
                          <th className="px-4 py-3">x Franja</th>
                          <th className="px-4 py-3">x Día</th>
                          <th className="px-4 py-3">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {franjaRows.map((row, index) => (
                          <tr key={`${row.fecha}-${row.franja}-${index}`} className="hover:bg-white/5">
                            <td className="px-4 py-3">{row.fecha}</td>
                            <td className="px-4 py-3">{row.hora_inicio} - {row.hora_fin}</td>
                            <td className="px-4 py-3">{row.franja}</td>
                            <td className="px-4 py-3">{row.horas}</td>
                            <td className="px-4 py-3">x{row.multiplicador_franja}</td>
                            <td className="px-4 py-3">x{row.multiplicador_dia}</td>
                            <td className="px-4 py-3 font-medium text-cyan-200">{Math.round(row.puntos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  )
}
