# Plan de Proyecto y Reglas de Desarrollo: La Rota Justa

## 1. Visión del Proyecto
"La Rota Justa" es un Micro-SaaS para la gestión de turnos en hostelería. Utiliza un algoritmo de "Puntos de Esfuerzo" para equilibrar la carga de trabajo de forma objetiva, eliminando favoritismos y automatizando la gestión colaborativa de turnos.

---

## 2. Stack Tecnológico Estricto
- **Frontend:** React + Vite (Optimizado para Progressive Web App - PWA).
- **Backend:** Node.js + Express (API REST limpia y modular).
- **Base de Datos:** PostgreSQL (usando el driver `pg` de Node.js).
- **Autenticación:** JWT (JSON Web Tokens). Contraseñas encriptadas con `bcrypt`.

---

## 3. Filosofía de Código (Criterio de Aceptación)
Para que el código sea mantenible por una sola persona apoyada en IA, se deben seguir estas reglas de desarrollo:
- **Funciones puras y cortas:** Ninguna función debe superar las 25 líneas de código.
- **Principio de Responsabilidad Única (SRP):** Una función calcula horas, otra busca multiplicadores, otra suma puntos. No se mezcla lógica.
- **Evitar "Hardcoding":** Todos los valores numéricos y multiplicadores deben vivir en un objeto de configuración centralizado (`constants.js`).
- **Sin duplicación (DRY):** La lógica de cálculo debe ser un servicio único que consuma tanto el validador de turnos del Backend como las previsualizaciones del Frontend.

---

## 4. El "Cerebro": Motor de Puntos (Algoritmo de Esfuerzo)

### 4.1. Configuración de Parámetros (Data de Control)
El sistema calculará los puntos basándose en un objeto de configuración estricto:
- **Valor Base:** 1 hora de trabajo = 10 puntos.
- **Multiplicadores por Franja Horaria (Se aplican sobre cada hora del tramo):**
  * Mañana (08:00 - 16:00): x1.0
  * Tarde/Cierre (16:00 - 00:00): x1.3
  * Noche (00:00 - 08:00): x1.6
- **Multiplicadores por Calendario:**
  * Lunes a Jueves: x1.0
  * Viernes a Domingo: x1.5
  * Festivos (Nacionales/Locales): x2.0 (Tiene prioridad absoluta sobre el día de la semana).
- **Bonus Especial:**
  * Turno Partido: +20 puntos directos al final de la jornada si el empleado tiene dos turnos el mismo día con un hueco de descanso superior a 2 horas entre el fin del primero y el inicio del segundo.

### 4.2. Lógica de Flujo del Algoritmo (Paso a Paso)
Cuando un mánager pasa el estado de la jornada de un empleado a `VALIDADO`, el sistema realiza la consolidación diaria en este orden:

1. **Identificación:** Agrupa todos los turnos asignados a un `usuario_id` en una `fecha` específica.
2. **Cálculo por Tramos:** Para cada turno, se divide el intervalo en segmentos horarios reales según las franjas definidas (Mañana / Tarde / Noche). Cada segmento acumula sus minutos de forma independiente. Por ejemplo, un turno de 15:00 a 17:00 genera 1h en la franja Mañana y 1h en la franja Tarde. La fórmula por segmento es: `Horas × Base × Multiplicador_Franja × Multiplicador_Día`.
3. **Evaluación de Turno Partido:** Si el número de turnos del día es mayor a 1, calcula el tiempo libre entre el final del primero y el inicio del segundo. Si ese hueco es > 2 horas, activa la bandera `turno_partido` y añade +20 puntos al total.
4. **Cierre Contable:** Guarda el desglose y el total en la tabla `historial_puntos_diarios` e incrementa el `saldo_puntos_actual` en el perfil del usuario.

### 4.3. Resoluciones de Casos de Borde (Edge Cases)
- **Cruce de franjas:** El cálculo se realiza por tramos horarios reales (ej: un turno de 15:00 a 17:00 acumula 1h de Mañana y 1h de Tarde).
- **Cruce de medianoche:** Si un turno cruza las 00:00, el sistema lo divide virtualmente en dos bloques independientes para aplicar el multiplicador de calendario correcto a cada día (ej: Jueves/Viernes).
- **Redondeo:** Todos los cálculos internos usan decimales exactos. El redondeo (`Math.round()`) se aplica exclusivamente al total final de puntos de la jornada diaria.
- **Festivos:** Se gestionan mediante un flag booleano (`es_festivo`) en la tabla de turnos. Tiene prioridad absoluta sobre el multiplicador de fin de semana.
- **Límite de Bonus:** El bonus de turno partido (+20 puntos) se aplica como máximo una vez al día por empleado.

---

## 5. Arquitectura del Backend (Estructura de Archivos)
El backend en Node.js + Express debe estructurarse estrictamente así:

```
src/
├── config/
│   └── constants.js        → Multiplicadores, puntos base y parámetros de franjas.
├── services/
│   └── pointsService.js    → Función pura de cálculo matemático del algoritmo.
├── controllers/
│   └── turnsController.js  → Maneja la petición HTTP y llama al servicio.
└── routes/
    └── turnsRoutes.js      → Define el endpoint POST /api/turnos/validar.
```

---

## 6. Reglas de Comportamiento Permanentes para Copilot

Estas reglas aplican a **todo el desarrollo del backend**, sin excepción:

1. **Funciones cortas:** Nunca superar 25 líneas por función. Si una función crece, dividirla.
2. **Modularidad SRP:** Cada función hace exactamente una cosa. No mezclar cálculo, I/O y lógica de negocio en la misma función.
3. **DRY estricto:** Antes de escribir lógica nueva, verificar si ya existe en un servicio. Reutilizar siempre.
4. **Sin hardcoding:** Cualquier número o constante va en `src/config/constants.js`. Nunca inline en el código.
5. **JavaScript moderno:** Preferir `.reduce()`, `.map()`, `.filter()`, desestructuración y `async/await` sobre bucles imperativos y callbacks.
6. **Seguridad OWASP:** Validar entradas en los controladores, usar consultas parametrizadas en todas las queries de PostgreSQL, nunca exponer stack traces al cliente.
7. **Base de datos:** Usar siempre el driver `pg` con consultas parametrizadas (`$1`, `$2`...). Nunca concatenar strings SQL.
8. **Auth:** Los endpoints protegidos deben validar el JWT en un middleware dedicado. Las contraseñas siempre se almacenan con `bcrypt` (mínimo 10 salt rounds).