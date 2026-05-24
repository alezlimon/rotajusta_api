import { api } from './api'

const SCHEDULE_BASE = '/schedule'

export const getScheduleBootstrap = ({ month, year }) =>
  api.get(`${SCHEDULE_BASE}/bootstrap?month=${month}&year=${year}`)

export const generateMonthlySchedule = ({ month, year, blocks }) =>
  api.post(`${SCHEDULE_BASE}/generate`, { month, year, blocks })

export const moveScheduleAssignment = ({ month, year, from, to }) =>
  api.patch(`${SCHEDULE_BASE}/assignment`, { month, year, from, to })
