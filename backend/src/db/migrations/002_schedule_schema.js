exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE schedule_blocks (
      id           SERIAL      PRIMARY KEY,
      year         INTEGER     NOT NULL,
      month        INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
      block_id     VARCHAR(80) NOT NULL,
      name         VARCHAR(80) NOT NULL,
      start_time   TIME        NOT NULL,
      end_time     TIME        NOT NULL,
      color        VARCHAR(80) NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_schedule_blocks UNIQUE (year, month, block_id)
    );

    CREATE INDEX idx_schedule_blocks_period ON schedule_blocks(year, month);

    CREATE TABLE schedule_assignments (
      id            SERIAL      PRIMARY KEY,
      year          INTEGER     NOT NULL,
      month         INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
      employee_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      day_of_month  INTEGER     NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
      block_id      VARCHAR(80) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_schedule_assignment_cell UNIQUE (year, month, employee_id, day_of_month)
    );

    CREATE INDEX idx_schedule_assignments_period ON schedule_assignments(year, month);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS schedule_assignments;
    DROP TABLE IF EXISTS schedule_blocks;
  `);
};
