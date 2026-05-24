exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE usuarios (
      id                  SERIAL        PRIMARY KEY,
      nombre              VARCHAR(100)  NOT NULL,
      email               VARCHAR(255)  NOT NULL UNIQUE,
      password_hash       VARCHAR(255)  NOT NULL,
      rol                 VARCHAR(20)   NOT NULL CHECK (rol IN ('MANAGER', 'EMPLOYEE')),
      saldo_puntos_actual INTEGER       NOT NULL DEFAULT 0 CHECK (saldo_puntos_actual >= 0),
      creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_usuarios_rol ON usuarios(rol);

    CREATE TABLE historial_puntos_diarios (
      id               SERIAL      PRIMARY KEY,
      usuario_id       INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha            DATE        NOT NULL,
      puntos_totales   INTEGER     NOT NULL CHECK (puntos_totales >= 0),
      es_turno_partido BOOLEAN     NOT NULL DEFAULT false,
      desglose         JSONB       NOT NULL DEFAULT '{}'::jsonb,
      creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_historial_usuario_fecha UNIQUE (usuario_id, fecha)
    );

    CREATE INDEX idx_historial_fecha ON historial_puntos_diarios(fecha);

    CREATE TABLE turnos_guardados (
      id           SERIAL      PRIMARY KEY,
      historial_id INTEGER     NOT NULL REFERENCES historial_puntos_diarios(id) ON DELETE CASCADE,
      usuario_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha        DATE        NOT NULL,
      hora_inicio  TIME        NOT NULL,
      hora_fin     TIME        NOT NULL,
      es_festivo   BOOLEAN     NOT NULL DEFAULT false,
      creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_turnos_usuario_fecha ON turnos_guardados(usuario_id, fecha);
    CREATE INDEX idx_turnos_fecha ON turnos_guardados(fecha);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS turnos_guardados;
    DROP TABLE IF EXISTS historial_puntos_diarios;
    DROP TABLE IF EXISTS usuarios;
  `);
};