Plan de Proyecto y Reglas de Desarrollo: La Rota Justa
1. Visión del Proyecto
"La Rota Justa" es un Micro-SaaS para la gestión de turnos en hostelería. Utiliza un algoritmo de "Puntos de Esfuerzo" para equilibrar la carga de trabajo de forma objetiva, eliminando favoritismos y automatizando la gestión colaborativa de turnos mediante una interfaz visual interactiva para el mánager.

2. Stack Tecnológico Estricto
Frontend: React + Vite + Tailwind CSS v4 (Optimizado para Progressive Web App - PWA).

Backend: Node.js + Express (API REST limpia y modular).

Base de Datos: PostgreSQL (usando el driver pg de Node.js).

Autenticación: JWT (JSON Web Tokens) inyectado automáticamente desde localStorage (rotajusta_token). Contraseñas encriptadas con bcrypt.

3. Filosofía de Código y UX (Criterio de Aceptación)
Para que el código sea mantenible por una sola persona apoyada en IA, se deben seguir estas reglas de desarrollo:

Funciones puras y cortas: Ninguna función (frontend o backend) debe superar las 25 líneas de código.

Principio de Responsabilidad Única (SRP): Una función calcula horas, otra renderiza una celda, otra despacha una acción. No se mezcla lógica.

Evitar "Hardcoding": Todos los valores numéricos, multiplicadores y rutas base deben vivir en objetos de configuración centralizados (constants.js o .env).

Sin duplicación (DRY): La lógica de cálculo debe ser un servicio único que consuma tanto el validador de turnos del Backend como las previsualizaciones del Frontend.

UI Atómica y Modular: Las vistas complejas se dividen en componentes pequeños y reutilizables para mantener la legibilidad y evitar archivos kilométricos.

4. El "Cerebro": Motor de Puntos (Algoritmo de Esfuerzo)
4.1. Configuración de Parámetros (Data de Control)
El sistema calculará los puntos basándose en un objeto de configuración estricto:

Valor Base: 1 hora de trabajo = 10 puntos.

Multiplicadores por Franja Horaria (Se aplican sobre cada hora del tramo):

Mañana (08:00 - 16:00): x1.0

Tarde/Cierre (16:00 - 00:00): x1.3

Noche (00:00 - 08:00): x1.6

Multiplicadores por Calendario:

Lunes a Jueves: x1.0

Viernes a Domingo: x1.5

Festivos (Nacionales/Locales): x2.0 (Tiene prioridad absoluta sobre el día de la semana).

Bonus Especial:

Turno Partido: +20 puntos directos al final de la jornada si el empleado tiene dos turnos el mismo día con un hueco de descanso superior a 2 horas entre el fin del primero y el inicio del segundo.

4.2. Lógica de Flujo del Algoritmo (Paso a Paso)
Cuando un mánager pasa el estado de la jornada de un empleado a VALIDADO, el sistema realiza la consolidación diaria en este orden:

Identificación: Agrupa todos los turnos asignados a un usuario_id en una fecha específica.

Cálculo por Tramos: Divide el intervalo en segmentos horarios reales según las franjas definidas. Cada segmento acumula sus minutos de forma independiente (Horas × Base × Multiplicador_Franja × Multiplicador_Día).

Evaluación de Turno Partido: Si el número de turnos del día es > 1 y el hueco es > 2 horas, activa la bandera turno_partido y añade +20 puntos al total.

Cierre Contable: Guarda el desglose y el total en historial_puntos_diarios e incrementa el saldo_puntos_actual del usuario.

4.3. Resoluciones de Casos de Borde (Edge Cases)
Cruce de franjas: El cálculo se realiza por tramos horarios reales.

Cruce de medianoche: Se divide virtualmente en dos bloques independientes para aplicar el multiplicador de calendario correcto a cada día (ej: Jueves/Viernes).

Redondeo: Todos los cálculos internos usan decimales exactos. El redondeo (Math.round()) se aplica exclusivamente al total final de puntos de la jornada diaria.

Festivos: Se gestionan mediante un flag booleano (es_festivo) en la tabla de turnos, con prioridad absoluta sobre el fin de semana.

Límite de Bonus: El bonus de turno partido (+20 puntos) se aplica como máximo una vez al día por empleado.

5. El Núcleo del Frontend: Automatización y Timeline del Mánager
La interfaz del mánager está diseñada para eliminar el trabajo manual mediante una experiencia visual, automatizada e interactiva dividida en tres pilares:

5.1. Panel de Configuración de Bloques Base
El mánager no escribe horas de forma manual en el día a día. Configura una sola vez las plantillas de turnos posibles del negocio:

Turnos Tipo (Bloques): Ej. Mañana (08:00 - 16:00), Tarde (16:00 - 00:00), Noche (00:00 - 08:00).

Cada bloque se asocia a un color identificativo en la interfaz para facilitar el escaneo visual rápido.

5.2. Generación Automática Mensual
La funcionalidad estrella de la aplicación permite rellenar un mes entero con un solo clic:

Input: El mánager selecciona el mes/año y pulsa el botón "Generar Rota Automática".

Lógica de Generación: El backend procesa las restricciones contractuales de los empleados (horas máximas, descansos obligatorios) y distribuye los Bloques Tipo optimizando el equilibrio de los Puntos de Esfuerzo.

5.3. Interfaz Visual en Timeline (Calendario Horizontal)
Una vez generada la rota, se presenta al mánager en una vista de alto impacto visual (ScheduleTimeline.jsx):

Eje Vertical (Filas): Listado de los empleados del equipo.

Eje Horizontal (Columnas): Los días del mes completo (desplazable en horizontal).

Celdas (Turnos): Los turnos asignados aparecen como "pastillas" o tarjetas redondeadas de colores que contienen el nombre del bloque o las horas.

Interactividad (Drag & Drop / Pick & Drop): El mánager puede reajustar la rota generada de forma manual pinchando un turno, arrastrándolo y soltándolo en otra celda o empleado. La base de datos se actualiza de manera transparente en el drop.

6. Arquitectura del Monorepo (Estructura de Archivos)
El proyecto se organiza bajo una estructura estricta de monorepo:

/
├── backend/
│   └── src/
│       ├── config/      → constants.js (Multiplicadores, puntos base, franjas).
│       ├── services/    → pointsService.js (Cálculo matemático puro).
│       ├── controllers/ → turnsController.js (HTTP y llamadas al servicio).
│       └── routes/      → turnsRoutes.js (POST /api/turnos/validar).
└── frontend/
    └── src/
        ├── api/         → api.js (Cliente fetch centralizado con inyección de JWT).
        ├── services/    → authService.js, turnosService.js, index.js (Barrel de red).
        ├── views/       → Login.jsx, ScheduleTimeline.jsx (Vistas principales).
        ├── components/  → Componentes atómicos reutilizables.
        └── index.css    → Configuración base de Tailwind v4 (@import "tailwindcss").
7. Reglas de Comportamiento Permanentes para Copilot
Estas reglas aplican a todo el ciclo de vida del desarrollo, sin excepción:

Funciones cortas: Nunca superar 25 líneas por función. Si una función crece, se divide obligatoriamente.

Modularidad SRP: Cada función hace una única cosa (cálculo, renderizado, I/O o lógica).

DRY estricto: Reutilizar servicios y componentes antes de escribir código nuevo.

Sin hardcoding: Valores numéricos, claves o constantes van en sus respectivos archivos de configuración.

JavaScript moderno: Uso preferente de métodos declarativos (.reduce(), .map(), .filter()), desestructuración y async/await.

Seguridad OWASP y CORS: Validación de datos de entrada, consultas parametrizadas en PostgreSQL ($1, $2), protección de endpoints con middleware JWT y configuración explícita de CORS para permitir peticiones desde el origen del frontend.