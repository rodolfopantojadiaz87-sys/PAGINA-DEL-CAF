# Novo Norte · Registro de atenciones

Aplicación web progresiva (PWA) para registrar a las personas que atiende el
centro y mantener el historial compartido de sus atenciones. Está construida
con React, TypeScript y Vite, y guarda los datos en Supabase.

## Iniciar y comprobar

Requisitos: Node.js y npm.

```bash
npm install
npm run dev
```

Para comprobar la versión de producción y generar el service worker:

```bash
npm run build
npm run preview
```

La instalación y el modo sin conexión funcionan en `localhost` durante pruebas
y en producción desde un origen HTTPS. En Android, abre el sitio en Chrome y
elige **Instalar aplicación** o **Añadir a pantalla de inicio** en el menú.

Comandos disponibles: `npm run dev`, `npm run build`, `npm run preview` y
`npm run lint`.

## Desplegar en Vercel

1. Sube este proyecto a un repositorio Git y, en Vercel, selecciona **Add New
   Project** para importar ese repositorio.
2. Usa la configuración de Vite: comando de instalación `npm install`, comando
   de compilación `npm run build` y directorio de salida `dist`.
3. En **Project Settings → Environment Variables**, agrega para cada entorno
   que vayas a publicar:
   - `VITE_SUPABASE_URL`: URL del proyecto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable del mismo proyecto.
4. Despliega el proyecto. Si cambias una variable de entorno, crea un nuevo
   despliegue para que Vite la incluya en la compilación.
5. En **Supabase → Authentication → URL Configuration**, configura **Site URL**
   con el dominio HTTPS de producción y agrega ese origen a **Redirect URLs**.
   Agrega también los dominios Preview de Vercel que realmente utilices. La
   recuperación de contraseña redirige al origen donde se abrió la aplicación.

`vercel.json` configura el fallback de navegación de la SPA y evita que el
navegador conserve una versión anterior del service worker o del manifiesto.
Las variables `VITE_*` se incluyen en el código público del navegador: no pongas
contraseñas ni claves `service_role` en ellas. La aplicación sólo necesita la
clave publicable; Supabase Auth y las políticas RLS deben estar configurados
como se explica en [`docs/SUPABASE.md`](./docs/SUPABASE.md).

## Secciones de la aplicación

- **Inicio**: funciona como recepción. Se busca a la persona que llega (por
  nombre, teléfono o correo, sin importar tildes) y se registra su atención, o
  se crea si es la primera vez. Muestra la actividad del día y del mes.
- **Registrar atención**: elige la persona (o crea una nueva), el proceso y la
  fecha. Avisa si ya existe alguien con un nombre parecido.
- **Personas**: directorio con búsqueda, filtros por nacionalidad, proceso y
  rango de fechas de atención, orden y exportación a CSV. Al pulsar una persona
  se abre su ficha con el historial y las acciones.
- **Atenciones**: registro cronológico de todas las atenciones con filtros
  (rango de fechas, periodos rápidos, proceso, nacionalidad y colaborador) y
  exportación a CSV o PDF con el listado.
- **Informes**: cifras, atenciones por mes, por proceso, por nacionalidad y por
  colaborador según los mismos filtros. El PDF imprime el periodo y los filtros
  aplicados y puede incluir el listado detallado. Atenciones e Informes
  comparten los filtros.
- **Miembros** (solo administración): alta de miembros con contraseña y rol,
  cambio de rol, desactivar y quitar.

## Cómo se organiza el código

- `src/App.tsx`: navegación entre secciones, ficha de persona y filtros
  compartidos.
- `src/components/`: estructura (`AppShell`), filtros, ficha de persona,
  gráficos de barras y por mes, historial y etiquetas de proceso.
- `src/pages/`: una página por sección, más acceso (`LoginPage`) y la pantalla
  para cuentas sin acceso (`WorkspaceGatePage`).
- `src/hooks/AttendanceDataProvider.tsx`: carga personas y atenciones una vez
  para toda la app y las refresca al guardar, editar o eliminar.
- `src/lib/filters.ts`: periodos, filtrado de atenciones y opciones de filtro.
- `src/lib/search.ts`: búsqueda de personas sin tildes y por relevancia.
- `src/lib/processes.ts`: color de cada proceso, usado en toda la app y el PDF.
- `src/statistics/aggregates.ts`: resumen de un conjunto de atenciones
  (personas distintas, personas nuevas, por proceso, nacionalidad, colaborador
  y mes).
- `src/pdf/report.ts`: informe PDF; `src/lib/csv.ts`: exportación CSV.
- `src/services/`: acceso a Supabase (personas, atenciones, miembros, sesión).
- `src/i18n.tsx`: textos en español y portugués.
- `src/index.css` y `src/App.css`: sistema visual (colores de la marca,
  tipografías Nunito y Public Sans) y estilos adaptados a móvil.
- `scripts/seed-local.mjs`: datos de prueba para el Supabase local.

## Probar en local con datos de prueba

Con Docker o Podman activo:

```bash
npx supabase start
node scripts/seed-local.mjs
```

Crea `.env.development.local` con la URL `http://127.0.0.1:54321` y la clave
publicable que muestra `npx supabase status`, y ejecuta `npm run dev`. El
script crea `admin@caf.test` y `colaborador@caf.test` (contraseña
`caf-local-123`), solo en local.

## Decisiones importantes

Una persona tiene un único registro y puede tener muchas atenciones. Las
estadísticas cuentan personas distintas para el total de personas y filas de
atención para el total de atenciones. "Personas nuevas" son las que tuvieron su
primera atención dentro del periodo filtrado.

Al registrar a alguien nuevo, la app sugiere personas con nombre parecido y, al
guardar, comprueba coincidencias por nombre, nacionalidad y teléfono o correo
para pedir confirmación antes de crear un duplicado. La atención se crea con
una función PostgreSQL transaccional que registra al colaborador autenticado.

## Datos compartidos y administración de acceso Supabase

El diseño inicial de la base de datos compartida, sus roles y permisos RLS está
en [`docs/SUPABASE.md`](./docs/SUPABASE.md). La migración SQL está en
[`supabase/migrations/20261110220000_shared_workspace.sql`](./supabase/migrations/20261110220000_shared_workspace.sql).
La aplicación incluye inicio de sesión y recuperación de contraseña. Copia
`.env.example` a `.env.local`, define la URL del proyecto y la clave publicable,
y reinicia Vite. Supabase Auth debe tener deshabilitado el registro público. El
administrador crea colaboradores desde **Configuración → Miembros del espacio**,
asignándoles nombre, correo, contraseña y rol. Los colaboradores entran con esas
credenciales; no necesitan invitación por correo.

La app verifica la membresía activa y el rol desde `workspace_members`. El
directorio, búsqueda, historial, registro, estadísticas e informes consultan la
base compartida con la sesión autenticada. RLS autoriza cada operación en el
servidor. Para la
configuración, despliegue de la Edge Function y pruebas con cuenta admin y
colaborador, sigue las instrucciones de [`docs/SUPABASE.md`](./docs/SUPABASE.md).

La Edge Function `create-user` se despliega en Supabase y usa
`SUPABASE_SERVICE_ROLE_KEY` sólo en su runtime. No agregues esa clave a
variables `VITE_*`, al frontend ni a Git. Vercel, si aloja el sitio, no gestiona
colaboradores ni recibe sus contraseñas.

La operación transaccional del registro de atenciones está en
[`supabase/migrations/20261110230000_register_attendance.sql`](./supabase/migrations/20261110230000_register_attendance.sql).
