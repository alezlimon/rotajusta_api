// Tests de integración para turnsController.
// Valida el endpoint POST /api/turnos/validar en todos sus escenarios.

// Configurar variables de entorno ANTES de cualquier import
process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const mockState = {
  historyPoints: null,
  nextTurnId: 1,
  turns: [],
};

const mockClient = {
  query: jest.fn(async (sql, params = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('SELECT id, puntos_totales FROM historial_puntos_diarios')) {
      return mockState.historyPoints === null
        ? { rows: [] }
        : { rows: [{ id: 1, puntos_totales: mockState.historyPoints }] };
    }
    if (sql.includes('SELECT id, usuario_id, fecha, puntos_totales, es_turno_partido, desglose FROM historial_puntos_diarios')) {
      return mockState.historyPoints === null
        ? { rows: [] }
        : { rows: [{ id: 1, usuario_id: 5, fecha: '2026-05-18', puntos_totales: mockState.historyPoints, es_turno_partido: false, desglose: { origen: 'manual' } }] };
    }
    if (sql.includes('VALUES ($1, $2, 0, false, $3) RETURNING id, puntos_totales')) {
      mockState.historyPoints = 0;
      return { rows: [{ id: 1, puntos_totales: 0 }] };
    }
    if (sql.includes('INSERT INTO historial_puntos_diarios') && sql.includes('ON CONFLICT')) {
      mockState.historyPoints = params[2];
      return { rows: [{ id: 1 }] };
    }
    if (sql.includes('INSERT INTO historial_puntos_diarios')) {
      mockState.historyPoints = params[2];
      return { rows: [{ id: 1, puntos_totales: params[2] }] };
    }
    if (sql.includes('SELECT id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo FROM turnos_guardados')) {
      return {
        rows: [...mockState.turns].sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio))),
      };
    }
    if (sql.includes('SELECT id, historial_id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo FROM turnos_guardados')) {
      const turno = mockState.turns.find((item) => item.id === params[0]);
      return { rows: turno ? [turno] : [] };
    }
    if (sql.includes('INSERT INTO turnos_guardados')) {
      const turno = {
        id: mockState.nextTurnId++,
        historial_id: params[0],
        usuario_id: params[1],
        fecha: params[2],
        hora_inicio: params[3],
        hora_fin: params[4],
        es_festivo: params[5],
      };
      mockState.turns.push(turno);
      return { rows: [{ id: turno.id }] };
    }
    if (sql.includes('UPDATE turnos_guardados SET hora_inicio')) {
      const turno = mockState.turns.find((item) => item.id === params[3]);
      if (turno) {
        turno.hora_inicio = params[0];
        turno.hora_fin = params[1];
        turno.es_festivo = params[2];
      }
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM turnos_guardados WHERE id = $1')) {
      mockState.turns = mockState.turns.filter((item) => item.id !== params[0]);
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM historial_puntos_diarios')) {
      mockState.historyPoints = null;
      return { rows: [] };
    }
    if (sql.includes('UPDATE usuarios SET saldo_puntos_actual = GREATEST')) {
      return { rows: [] };
    }
    if (sql.includes('UPDATE usuarios SET saldo_puntos_actual = saldo_puntos_actual + $1')) {
      return { rows: [] };
    }
    return { rows: [{ id: 1 }] };
  }),
  release: jest.fn(),
};

jest.mock('../config/db', () => ({
  pool: {
    connect: jest.fn(() => Promise.resolve(mockClient)),
  },
}));

const request = require('supertest');
const { MANAGER_TOKEN, EMPLOYEE_TOKEN, EXPIRED_TOKEN, INVALID_TOKEN } = require('../test/fixtures/tokens');
const { app } = require('../app');

describe('POST /api/turnos/validar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.historyPoints = null;
    mockState.nextTurnId = 1;
    mockState.turns = [];
  });

  // --- 200 OK ---

  test('200: JWT válido + rol MANAGER + payload correcto', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      es_festivo: false,
      turnos: [
        { hora_inicio: '09:00', hora_fin: '13:00' },
        { hora_inicio: '18:00', hora_fin: '22:00' },
      ],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('empleado_id', 5);
    expect(res.body).toHaveProperty('puntos_calculados');
    expect(res.body).toHaveProperty('es_turno_partido');
    expect(res.body).toHaveProperty('desglose');
    expect(res.body.desglose).toHaveProperty('turnos');
    expect(typeof res.body.puntos_calculados).toBe('number');
  });

  // --- 401 Unauthorized ---

  test('401: Sin token en Authorization header', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Token requerido/i);
  });

  test('401: Token expirado', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${EXPIRED_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  test('401: Token con firma inválida', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${INVALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  // --- 403 Forbidden ---

  test('403: Token válido pero rol EMPLEADO (no MANAGER)', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${EMPLOYEE_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MANAGER/i);
  });

  // --- 400 Bad Request ---

  test('400: Payload vacío', async () => {
    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Faltan campos/i);
  });

  test('400: Fecha en formato inválido', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '18-05-2026', // Formato incorrecto
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fecha/i);
  });

  test('400: Turno sin hora_inicio', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_fin: '13:00' }], // Falta hora_inicio
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/HH:MM/i);
  });
});

describe('CRUD manual de turnos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.historyPoints = null;
    mockState.nextTurnId = 1;
    mockState.turns = [];
  });

  test('201: crear turno manual y recalcular jornada', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      hora_inicio: '09:00',
      hora_fin: '13:00',
      es_festivo: false,
    };

    const res = await request(app)
      .post('/api/turnos/manual')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('turno');
    expect(res.body.turno).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('jornada');
    expect(mockState.turns).toHaveLength(1);
  });

  test('200: editar turno manual existente', async () => {
    mockState.turns = [{ id: 7, historial_id: 1, usuario_id: 5, fecha: '2026-05-18', hora_inicio: '09:00', hora_fin: '13:00', es_festivo: false }];
    mockState.historyPoints = 40;

    const res = await request(app)
      .patch('/api/turnos/manual/7')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({
        empleado_id: 5,
        fecha: '2026-05-18',
        hora_inicio: '10:00',
        hora_fin: '14:00',
        es_festivo: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.turno).toHaveProperty('id', 7);
    expect(mockState.turns[0].hora_inicio).toBe('10:00');
  });

  test('200: borrar turno manual existente', async () => {
    mockState.turns = [{ id: 9, historial_id: 1, usuario_id: 5, fecha: '2026-05-18', hora_inicio: '09:00', hora_fin: '13:00', es_festivo: false }];
    mockState.historyPoints = 40;

    const res = await request(app)
      .delete('/api/turnos/manual/9')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deleted', true);
    expect(mockState.turns).toHaveLength(0);
  });

  test('200: listar turnos manuales de un dia', async () => {
    mockState.turns = [
      { id: 2, historial_id: 1, usuario_id: 5, fecha: '2026-05-18', hora_inicio: '09:00', hora_fin: '13:00', es_festivo: false },
      { id: 3, historial_id: 1, usuario_id: 5, fecha: '2026-05-18', hora_inicio: '18:00', hora_fin: '22:00', es_festivo: false },
    ];
    mockState.historyPoints = 120;

    const res = await request(app)
      .get('/api/turnos/manual?empleado_id=5&fecha=2026-05-18')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.turnos).toHaveLength(2);
    expect(res.body.jornada).toHaveProperty('puntos_totales', 120);
  });
});
