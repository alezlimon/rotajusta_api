Plan de Proyecto y Reglas de Desarrollo: La Rota Justa (v2.2)

1. Objetivo de Producto (Prioridad Actual)
"La Rota Justa" prioriza generar rotas mensuales realistas para hostelería.

Decisión estratégica vigente:
- Máximo realismo > velocidad de generación.
- Patrón objetivo: 5 días trabajados + 2 días libres consecutivos por semana.
- Excepciones permitidas: equilibrio con cobertura, pero limitadas y explicables.

2. Stack Tecnológico Estricto
- Frontend: React + Vite + Tailwind CSS v4.
- Backend: Node.js + Express (API REST modular).
- Base de datos: PostgreSQL con pg.
- Auth: JWT en localStorage (rotajusta_token) + bcrypt.

3. Reglas de Ingeniería (No Negociables)
- Funciones cortas: máximo 25 líneas por función/helper.
- SRP: una función, una responsabilidad.
- DRY estricto: no duplicar lógica entre backend y frontend.
- Sin hardcoding: usar constants.js o .env.
- JS moderno: map/filter/reduce, async/await, desestructuración.
- Seguridad OWASP: validación de entrada, SQL parametrizada, JWT middleware, CORS explícito.

4. Contrato del Motor de Rota (Estado Actual)
4.1. Jerarquía de Reglas
1) Reglas duras (siempre):
- Límite horas semanales.
- Descanso tras turno de noche.
- Sin doble asignación del mismo empleado en un día.

2) Reglas objetivo (optimización):
- Cumplir 5+2 semanal.
- Priorizar 2 libres consecutivos.
- Minimizar cambios abruptos de bloque.

3) Fallback controlado:
- Permitir 6+1 solo cuando la cobertura lo exige.
- Límite objetivo de producto: máximo 1 excepción 6+1 por empleado y mes.

4.2. Arquitectura de Generación
- Fase A: preasignación dinámica de libranzas semanales (sin plantillas estáticas).
- Fase B: asignación de bloques en días laborables respetando reglas duras.
- Fallback: degradación progresiva y trazable (motivo explícito por incidencia).

4.3. Transparencia obligatoria
El payload de audit debe explicar la calidad de rota:
- Cobertura (cubiertos/total).
- Dispersión de puntos.
- Alertas críticas.
- Cumplimiento 5+2.
- Conteo de fallback 6+1 y motivos.

5. UX y Jerarquía Visual (Estado Objetivo)
La interfaz debe reducir carga cognitiva del mánager con separación por vistas:

1) Resumen
- KPI ejecutivo y estado global de rota.

2) Timeline (vista principal por defecto)
- Operación diaria: generar, ajustar drag/drop, validar cobertura visual.

3) Alertas y Analítica
- Semáforos y causas de fallback en formato accionable.

Prioridades UX confirmadas:
- Timeline como vista principal.
- KPI superiores: Cobertura, Dispersión, Alertas críticas.
- Analítica simple por semáforos (no sobrecargar con tablas por defecto).

6. Monorepo y Estructura Base
/
├── backend/
│   └── src/
│       ├── config/
│       ├── services/
│       ├── controllers/
│       └── routes/
└── frontend/
    └── src/
        ├── api/
        ├── services/
        ├── views/
        ├── components/
        └── constants/

7. Reglas de Colaboración con Copilot
- Priorizar claridad, realismo y mantenibilidad por encima de meter features.
- Todo cambio de motor debe incluir test de guardrail.
- Todo cambio UX debe leerse en menos de 5 segundos.
- Todo código debe ser simple, reutilizable y fácil de mantener.
- Ninguna función/helper debe superar 25 líneas; si crece, se divide.
- Preferir composición y reutilización antes que duplicación o lógica densa.

8. Roadmap de Producto Prioritario
Antes de tocar roles avanzados, el orden de trabajo es:

1) Base operativa: crear, editar y eliminar turnos manualmente; abrir perfil de empleado desde su nombre.
2) Continuidad entre meses: arrastrar la puntuación del mes anterior para influir en el siguiente.
3) Perfil de empleado: datos básicos, puntuación, horas recientes, turnos recientes, etiquetas y notas.
4) Etiquetas y skills: preferencias (#noches, #tardes, #mañanas) y habilidades (supervisor, barista, cocktelero, jefe_partida, parrilla).
5) Roles y jerarquía avanzada: se tratará aparte, no mezclar con la capa inicial de perfiles y etiquetas.