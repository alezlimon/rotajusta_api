import { api } from './api'

const VALIDAR_JORNADA_PATH = '/turnos/validar'

// Ejemplo de payload esperado por backend:
// {
//   empleado_id: 7,
//   fecha: '2026-05-17',
//   es_festivo: false,
//   turnos: [
//     { hora_inicio: '09:00', hora_fin: '13:00' },
//     { hora_inicio: '16:00', hora_fin: '20:00' },
//   ],
// }
export const validarJornada = (payload) => api.post(VALIDAR_JORNADA_PATH, payload)
