// Especificación OpenAPI 3.0 centralizada para La Rota Justa API.
// Montada en /api-docs SOLO en entorno development (seguridad OWASP).

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'La Rota Justa API',
    version: '1.0.0',
    description: 'API REST para gestión de turnos y cálculo de puntos de esfuerzo en hostelería.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Desarrollo local' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT con payload `{ id, role }`. El rol debe ser `MANAGER` para este endpoint.',
      },
    },
    schemas: {
      Turno: {
        type: 'object',
        required: ['hora_inicio', 'hora_fin', 'es_festivo'],
        properties: {
          hora_inicio: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' },
          hora_fin:    { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '17:00' },
          es_festivo:  { type: 'boolean', example: false },
        },
      },
      ValidarJornadaRequest: {
        type: 'object',
        required: ['empleado_id', 'fecha', 'turnos'],
        properties: {
          empleado_id: { type: 'integer', minimum: 1, example: 42 },
          fecha:       { type: 'string', format: 'date', example: '2026-05-17' },
          turnos: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: { $ref: '#/components/schemas/Turno' },
          },
        },
      },
      ValidarJornadaResponse: {
        type: 'object',
        properties: {
          empleado_id:        { type: 'integer', example: 42 },
          fecha:              { type: 'string', format: 'date', example: '2026-05-17' },
          puntos_calculados:  { type: 'integer', example: 115 },
          turnos_procesados:  { type: 'integer', example: 2 },
          es_turno_partido:   { type: 'boolean', example: true },
        },
      },
      BasicHealth: {
        type: 'object',
        properties: {
          status:      { type: 'string', enum: ['ok'], example: 'ok' },
          timestamp:   { type: 'string', format: 'date-time', example: '2026-05-17T22:14:35.123Z' },
          uptime:      { type: 'number', description: 'Segundos desde que arrancó el proceso', example: 1245 },
          environment: { type: 'string', example: 'development' },
        },
      },
      ReadinessProbe: {
        allOf: [
          { $ref: '#/components/schemas/BasicHealth' },
          {
            type: 'object',
            properties: {
              status:   { type: 'string', enum: ['ready', 'not_ready'], example: 'ready' },
              database: { type: 'boolean', description: 'true si PostgreSQL responde', example: true },
            },
          },
        ],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Descripción del error' },
        },
      },
      EmployeeProfileResponse: {
        type: 'object',
        properties: {
          employee: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 42 },
              nombre: { type: 'string', example: 'Ana Camarera' },
              email: { type: 'string', example: 'ana.employee@rotajusta.local' },
              role: { type: 'string', example: 'EMPLOYEE' },
              saldo_puntos_actual: { type: 'integer', example: 84 },
            },
          },
          summary: {
            type: 'object',
            properties: {
              recent_points: { type: 'integer', example: 75 },
              recent_days: { type: 'integer', example: 2 },
              recent_hours: { type: 'number', example: 8 },
              recent_turns: { type: 'integer', example: 2 },
            },
          },
          recent_history: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fecha: { type: 'string', format: 'date', example: '2026-05-18' },
                puntos_totales: { type: 'integer', example: 40 },
                es_turno_partido: { type: 'boolean', example: false },
              },
            },
          },
          recent_turns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fecha: { type: 'string', format: 'date', example: '2026-05-18' },
                hora_inicio: { type: 'string', example: '09:00' },
                hora_fin: { type: 'string', example: '13:00' },
                es_festivo: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/turnos/validar': {
      post: {
        tags: ['Turnos'],
        summary: 'Valida la jornada diaria de un empleado y consolida sus puntos.',
        description: [
          'Requiere rol **MANAGER**. Calcula los puntos de esfuerzo usando:',
          '- Franjas horarias (Mañana x1.0 / Tarde x1.3 / Noche x1.6)',
          '- Multiplicadores de calendario (LJ x1.0 / VS x1.5 / Festivo x2.0)',
          '- Bonus turno partido (+20 pts si hay > 2h de descanso entre turnos)',
          '',
          'Guarda el resultado en `historial_puntos_diarios` y actualiza `saldo_puntos_actual`.',
        ].join('\n'),
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidarJornadaRequest' },
              examples: {
                turnoSimple: {
                  summary: 'Turno simple de mañana (día laboral)',
                  value: { empleado_id: 42, fecha: '2026-05-18', turnos: [{ hora_inicio: '09:00', hora_fin: '17:00', es_festivo: false }] },
                },
                turnoPartido: {
                  summary: 'Turno partido en festivo (activa bonus)',
                  value: { empleado_id: 7, fecha: '2026-05-01', turnos: [{ hora_inicio: '10:00', hora_fin: '13:00', es_festivo: true }, { hora_inicio: '20:00', hora_fin: '23:00', es_festivo: true }] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Jornada validada y puntos consolidados correctamente.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidarJornadaResponse' } } },
          },
          400: {
            description: 'Payload inválido (campos faltantes, formato incorrecto o array vacío).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'El campo turnos debe ser un array con al menos 1 elemento' } } },
          },
          401: {
            description: 'Token JWT ausente o inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Token inválido o expirado' } } },
          },
          403: {
            description: 'El usuario autenticado no tiene el rol MANAGER.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Acceso denegado: se requiere rol MANAGER' } } },
          },
          500: {
            description: 'Error interno del servidor (fallo de base de datos).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Error interno del servidor' } } },
          },
        },
      },
    },
    '/api/auth/employees/{employee_id}/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Devuelve un perfil resumido de empleado.',
        description: 'Requiere rol MANAGER. Incluye datos básicos, resumen reciente, últimos turnos e historial reciente.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'employee_id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, example: 42 },
            description: 'Identificador del empleado a consultar.',
          },
        ],
        responses: {
          200: {
            description: 'Perfil resumido del empleado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeProfileResponse' } } },
          },
          400: {
            description: 'employee_id inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'employee_id inválido' } } },
          },
          401: {
            description: 'Token JWT ausente o inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Token inválido o expirado' } } },
          },
          403: {
            description: 'El usuario autenticado no tiene el rol MANAGER.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Acceso denegado: se requiere rol MANAGER' } } },
          },
          404: {
            description: 'Empleado no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Empleado no encontrado' } } },
          },
          500: {
            description: 'Error interno del servidor.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Error interno del servidor' } } },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Diagnóstico'],
        summary: 'Liveness probe — verifica que el servidor está vivo.',
        description: 'Endpoint de diagnóstico básico. No verifica dependencias externas.',
        responses: {
          200: {
            description: 'Servidor operativo.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BasicHealth' } } },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Diagnóstico'],
        summary: 'Readiness probe — verifica que el servidor está listo para recibir tráfico.',
        description: 'Comprueba la conectividad con PostgreSQL. Devuelve 503 si la BD no responde.',
        responses: {
          200: {
            description: 'Servidor listo (base de datos accesible).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessProbe' } } },
          },
          503: {
            description: 'Servidor no listo (base de datos no responde).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessProbe' }, example: { status: 'not_ready', timestamp: '2026-05-17T22:00:00.000Z', uptime: 30, environment: 'production', database: false } } },
          },
        },
      },
    },
  },
};

module.exports = { swaggerDefinition };
