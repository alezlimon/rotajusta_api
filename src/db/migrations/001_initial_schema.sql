-- ============================================================
-- Migración 001: Schema inicial de La Rota Justa
-- ============================================================

-- -------------------------------------------------------
-- TABLA: usuarios
-- Almacena empleados y managers. El saldo_puntos_actual es
-- un balance cacheado que se actualiza en cada validación.
-- -------------------------------------------------------
CREATE TABLE usuarios (
  id                   SERIAL        PRIMARY KEY,
  nombre               VARCHAR(100)  NOT NULL,
  email                VARCHAR(255)  NOT NULL UNIQUE,
  password_hash        VARCHAR(255)  NOT NULL,
  rol                  VARCHAR(20)   NOT NULL
                         CHECK (rol IN ('MANAGER', 'EMPLOYEE')),
  saldo_puntos_actual  INTEGER       NOT NULL DEFAULT 0
                         CHECK (saldo_puntos_actual >= 0),
  creado_en            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para filtrar por rol (ej: listar todos los managers)
CREATE INDEX idx_usuarios_rol ON usuarios(rol);


-- -------------------------------------------------------
-- TABLA: historial_puntos_diarios
-- Una fila por empleado por día validado. La constraint UNIQUE
-- garantiza que la misma jornada no se pueda consolidar dos veces.
-- desglose almacena el breakdown del cálculo para auditabilidad.
-- -------------------------------------------------------
CREATE TABLE historial_puntos_diarios (
  id                SERIAL      PRIMARY KEY,
  usuario_id        INTEGER     NOT NULL
                      REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha             DATE        NOT NULL,
  puntos_totales    INTEGER     NOT NULL CHECK (puntos_totales >= 0),
  es_turno_partido  BOOLEAN     NOT NULL DEFAULT false,
  desglose          JSONB       NOT NULL DEFAULT '{}',
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_historial_usuario_fecha UNIQUE (usuario_id, fecha)
);

-- Índice para consultas por empleado (perfil, ranking)
CREATE INDEX idx_historial_usuario ON historial_puntos_diarios(usuario_id);

-- Índice para consultas por fecha (vista del manager por día)
CREATE INDEX idx_historial_fecha ON historial_puntos_diarios(fecha);


-- -------------------------------------------------------
-- TABLA: turnos_guardados
-- Registro inmutable de cada turno que justificó un cálculo diario.
-- Ligado al historial para auditabilidad completa.
-- -------------------------------------------------------
CREATE TABLE turnos_guardados (
  id            SERIAL      PRIMARY KEY,
  historial_id  INTEGER     NOT NULL
                  REFERENCES historial_puntos_diarios(id) ON DELETE CASCADE,
  usuario_id    INTEGER     NOT NULL
                  REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha         DATE        NOT NULL,
  hora_inicio   TIME        NOT NULL,
  hora_fin      TIME        NOT NULL,
  es_festivo    BOOLEAN     NOT NULL DEFAULT false,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice compuesto para la búsqueda más frecuente: turnos de un empleado en una fecha
CREATE INDEX idx_turnos_usuario_fecha ON turnos_guardados(usuario_id, fecha);

-- Índice para vista de manager: todos los turnos de un día concreto
CREATE INDEX idx_turnos_fecha ON turnos_guardados(fecha);
