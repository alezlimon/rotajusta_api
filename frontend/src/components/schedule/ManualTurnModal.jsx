import { useEffect, useMemo, useState } from 'react'
import { createManualTurn, deleteManualTurn, getManualTurns, updateManualTurn } from '../../services/scheduleService'

const emptyForm = (employeeId = '', fecha = '') => ({
  empleado_id: employeeId,
  fecha,
  hora_inicio: '09:00',
  hora_fin: '13:00',
  es_festivo: false,
})

const normalizeForm = (form) => ({
  empleado_id: Number(form.empleado_id),
  fecha: form.fecha,
  hora_inicio: form.hora_inicio,
  hora_fin: form.hora_fin,
  es_festivo: Boolean(form.es_festivo),
})

const titleForMode = (editingTurnId) => (editingTurnId ? 'Editar turno manual' : 'Crear turno manual')

export function ManualTurnModal({ isOpen, employees, initialEmployeeId, initialDate, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm(initialEmployeeId, initialDate))
  const [turnos, setTurnos] = useState([])
  const [jornada, setJornada] = useState(null)
  const [editingTurnId, setEditingTurnId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const employeeLabel = useMemo(() => {
    const employee = employees.find((item) => Number(item.id) === Number(form.empleado_id))
    return employee?.name || 'Empleado'
  }, [employees, form.empleado_id])

  const loadTurns = async (payload) => {
    setLoading(true)
    setError('')
    try {
      const data = await getManualTurns(payload)
      setTurnos(data.turnos || [])
      setJornada(data.jornada || null)
    } catch (currentError) {
      setError(currentError.message || 'No se pudieron cargar los turnos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setForm(emptyForm(initialEmployeeId, initialDate))
    setEditingTurnId(null)
    setTurnos([])
    setJornada(null)
    if (initialEmployeeId && initialDate) loadTurns({ empleado_id: initialEmployeeId, fecha: initialDate })
  }, [isOpen, initialEmployeeId, initialDate])

  useEffect(() => {
    if (!isOpen || editingTurnId) return
    if (!form.empleado_id || !form.fecha) return
    loadTurns({ empleado_id: form.empleado_id, fecha: form.fecha })
  }, [form.empleado_id, form.fecha, editingTurnId, isOpen])

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const refreshTurns = async (nextForm = form) => {
    const normalized = normalizeForm(nextForm)
    if (!normalized.empleado_id || !normalized.fecha) return
    await loadTurns(normalized)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = normalizeForm(form)
      if (editingTurnId) {
        await updateManualTurn({ turno_id: editingTurnId, ...payload })
      } else {
        await createManualTurn(payload)
      }
      await refreshTurns(form)
      onSaved?.()
      setEditingTurnId(null)
    } catch (currentError) {
      setError(currentError.message || 'No se pudo guardar el turno')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (turnoId) => {
    if (!window.confirm('¿Eliminar este turno manual?')) return
    setSaving(true)
    setError('')
    try {
      await deleteManualTurn(turnoId)
      await refreshTurns(form)
      onSaved?.()
      setEditingTurnId(null)
    } catch (currentError) {
      setError(currentError.message || 'No se pudo eliminar el turno')
    } finally {
      setSaving(false)
    }
  }

  const handlePickTurn = (turno) => {
    setEditingTurnId(turno.id)
    setForm({
      empleado_id: turno.usuario_id,
      fecha: turno.fecha,
      hora_inicio: turno.hora_inicio.slice(0, 5),
      hora_fin: turno.hora_fin.slice(0, 5),
      es_festivo: Boolean(turno.es_festivo),
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Turnos manuales</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{titleForMode(editingTurnId)}</h3>
            <p className="mt-1 text-sm text-slate-400">{employeeLabel} · {form.fecha || 'Sin fecha'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">
            Cerrar
          </button>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-300">
              Empleado
              <select
                value={form.empleado_id}
                onChange={(event) => setField('empleado_id', event.target.value)}
                disabled={Boolean(editingTurnId)}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Selecciona empleado</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Fecha
              <input
                type="date"
                value={form.fecha}
                onChange={(event) => setField('fecha', event.target.value)}
                disabled={Boolean(editingTurnId)}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Hora inicio
              <input type="time" value={form.hora_inicio} onChange={(event) => setField('hora_inicio', event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Hora fin
              <input type="time" value={form.hora_fin} onChange={(event) => setField('hora_fin', event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.es_festivo} onChange={(event) => setField('es_festivo', event.target.checked)} />
            Festivo
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} disabled={saving || loading} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-cyan-300/60">
              {saving ? 'Guardando...' : editingTurnId ? 'Actualizar turno' : 'Crear turno'}
            </button>
            <button type="button" onClick={() => { setEditingTurnId(null); setForm(emptyForm(initialEmployeeId, initialDate)) }} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200">
              Nuevo turno
            </button>
            <button type="button" onClick={() => refreshTurns(form)} disabled={loading} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? 'Cargando...' : 'Refrescar'}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Turnos del día</h4>
            <span className="text-xs text-slate-400">{turnos.length} turno(s)</span>
          </div>

          <div className="mt-3 space-y-2">
            {turnos.length ? turnos.map((turno) => (
              <article key={turno.id} className={`rounded-xl border px-3 py-3 ${editingTurnId === turno.id ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/10 bg-slate-900/70'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{turno.hora_inicio.slice(0, 5)} - {turno.hora_fin.slice(0, 5)}</p>
                    <p className="text-xs text-slate-400">{turno.es_festivo ? 'Festivo' : 'Laborable'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handlePickTurn(turno)} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-slate-200">Editar</button>
                    <button type="button" onClick={() => handleDelete(turno.id)} disabled={saving} className="rounded-lg border border-rose-400/30 px-3 py-1 text-xs text-rose-200 disabled:cursor-not-allowed disabled:opacity-70">Borrar</button>
                  </div>
                </div>
              </article>
            )) : <p className="text-sm text-slate-400">No hay turnos para este día.</p>}
          </div>
        </section>

        {jornada ? (
          <section className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold">Jornada recalculada</p>
            <p className="mt-1">Puntos: {jornada.puntos_totales ?? jornada.puntos ?? 0}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}