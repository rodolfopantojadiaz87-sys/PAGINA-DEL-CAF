# Sistema compartido de registro de atenciones

Aplicación web progresiva (PWA) para registrar personas y mantener el historial
compartido de sus atenciones. Está construida con React, TypeScript y Vite; los
registros nuevos se guardan en Supabase cuando el proyecto está configurado.
Los registros anteriores de Dexie permanecen locales y no se migran
automáticamente.

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

## Cómo se organiza el código

- `index.html`: documento inicial, idioma español y metadatos de la app.
- `src/main.tsx`: crea la raíz de React y carga los estilos globales.
- `src/App.tsx`: decide qué sección mostrar y abre cada página bajo demanda.
- `src/components/`: navegación, títulos de sección e historial reutilizables.
- `src/pages/`: inicio, registro, búsqueda, personas, estadísticas, informes y
  configuración; cada sección tiene su propio archivo.
- `src/database/database.ts`: define la base IndexedDB con Dexie. `people`
  contiene datos personales; `appointments` conserva cada visita, y
  `nationalityColors` guarda los colores asignados. Las actualizaciones del
  código no borran esas tablas.
- `src/services/people.ts`: guarda personas, evita duplicados, busca y consulta
  historiales, y elimina una persona junto con sus atenciones.
- `src/services/backup.ts`: exporta y valida/restaura copias JSON.
- `src/hooks/useAttendanceData.ts`: observa la base de datos y actualiza los
  resúmenes cuando cambian los registros.
- `src/statistics/aggregates.ts`: calcula personas distintas, atenciones y
  procesos por semestre.
- `src/services/nationalityColors.ts`: asigna y conserva un color exclusivo para
  cada nacionalidad.
- `src/components/NationalityLegend.tsx`: muestra país, cantidad y porcentaje
  con el mismo color que los gráficos y los informes.
- `src/pdf/semesterReport.ts`: crea el informe PDF y sus tablas/gráficos.
- `src/types/records.ts`: define las formas de los registros y los procesos.
- `src/lib/supabase.ts`, `src/services/authService.ts` y `src/auth/`: cliente
  tipado, operaciones de autenticación y protección de la aplicación.
- `src/types/database.types.ts`: tipos TypeScript del esquema Supabase.
- `.env.example`: variables publicables requeridas; cópialo a `.env.local` y
  completa los valores del proyecto Supabase.
- `src/App.css` y `src/index.css`: estilos del panel y reglas globales
  adaptables a pantallas pequeñas.
- `vite.config.ts` y `public/`: manifiesto, iconos instalables, caché offline
  y actualización de la PWA. Los iconos de instalación están en
  `public/icons/`; `public/favicon.ico` y `public/apple-touch-icon.png` usan el
  icono original que proporcionaste. `manifest.webmanifest` se genera durante
  la compilación con la configuración de `vite.config.ts`.

## Colores e iconos

Cada nacionalidad recibe un color persistente en IndexedDB. El selector usa
primero una paleta diferenciable y genera colores adicionales si se agota; las
asignaciones existentes no cambian al añadir países. Las páginas de estadísticas
y los informes usan la misma asignación.

El icono original se conserva en `public/favicon.ico`. Los tamaños de Android y
el icono adaptable están en `public/icons/`, y el de iPhone en
`public/apple-touch-icon.png`. Para reemplazar el diseño, sustituye estos
archivos por imágenes con los mismos nombres y tamaños. Para cambiar el nombre
de la aplicación, modifica `name`, `short_name` y `description` en
`vite.config.ts`, además del `<title>` y la descripción en `index.html`.

La app se instala desde `localhost` o HTTPS. En iPhone, abre la app en Safari,
usa **Compartir → Añadir a pantalla de inicio**. El service worker almacena la
interfaz para uso sin conexión; los registros y colores están en IndexedDB y no
se eliminan al instalar una actualización.

## Decisiones importantes

Una persona tiene un único registro personal y puede tener muchas atenciones.
Cada atención guarda su propia fecha y proceso. Por ello, las estadísticas
cuentan IDs de personas distintos para el total de personas, y filas de
atención para el total de visitas/procesos.

En un registro nuevo, una coincidencia por nombre, nacionalidad y teléfono o
correo solicita confirmación para añadir la atención a la persona existente.
Si hay varias coincidencias, se pide buscar y seleccionar la persona correcta.
La atención se crea con una función PostgreSQL transaccional y registra al
colaborador autenticado.

Las copias de seguridad JSON antiguas son locales y sin cifrar. La pantalla de
configuración compartida no exporta ni restaura esa base local; la
administración de copias compartidas se implementará por separado.

El proyecto avanza por etapas: estructura y panel; base/formulario; búsqueda e
historial; estadísticas; informes y PDF; y PWA/offline. La compilación de
producción y el lint comprueban el código.

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
servidor. Los registros de Dexie de esta instalación quedan separados. Para la
configuración, despliegue de la Edge Function y pruebas con cuenta admin y
colaborador, sigue las instrucciones de [`docs/SUPABASE.md`](./docs/SUPABASE.md).

La Edge Function `create-user` se despliega en Supabase y usa
`SUPABASE_SERVICE_ROLE_KEY` sólo en su runtime. No agregues esa clave a
variables `VITE_*`, al frontend ni a Git. Vercel, si aloja el sitio, no gestiona
colaboradores ni recibe sus contraseñas.

La operación transaccional del registro de atenciones está en
[`supabase/migrations/20261110230000_register_attendance.sql`](./supabase/migrations/20261110230000_register_attendance.sql).
