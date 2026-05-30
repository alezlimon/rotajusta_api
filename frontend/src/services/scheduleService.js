import { api } from './api'

const SCHEDULE_BASE = '/schedule'

export const getScheduleBootstrap = ({ month, year }) =>
  api.get(`${SCHEDULE_BASE}/bootstrap?month=${month}&year=${year}`)

export const generateMonthlySchedule = ({ month, year, blocks }) =>
  api.post(`${SCHEDULE_BASE}/generate`, { month, year, blocks })

export const moveScheduleAssignment = ({ month, year, from, to }) =>
  api.patch(`${SCHEDULE_BASE}/assignment`, { month, year, from, to })

export const createManualTurn = ({ empleado_id, fecha, hora_inicio, hora_fin, es_festivo }) =>
  api.post('/turnos/manual', { empleado_id, fecha, hora_inicio, hora_fin, es_festivo })

export const getManualTurns = ({ empleado_id, fecha }) =>
  api.get(`/turnos/manual?empleado_id=${empleado_id}&fecha=${fecha}`)

export const updateManualTurn = ({ turno_id, empleado_id, fecha, hora_inicio, hora_fin, es_festivo }) =>
  api.patch(`/turnos/manual/${turno_id}`, { empleado_id, fecha, hora_inicio, hora_fin, es_festivo })

export const deleteManualTurn = (turno_id) =>
  api.del(`/turnos/manual/${turno_id}`)
