import { SCHEDULE_CONFIG } from '../../constants/schedule'

export const makeCellKey = (employeeId, day) => `${employeeId}-${day}`

export const toMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString(SCHEDULE_CONFIG.LOCALE, { month: 'long', year: 'numeric' })

export const createBlockDraft = () => ({
  name: '',
  start: '08:00',
  end: '16:00',
  color: 'bg-emerald-400 text-slate-950',
})
