# Diseño de datos compartidos con Supabase

## Alcance

La aplicación usa el espacio compartido de Supabase para los registros nuevos.
Los datos anteriores de IndexedDB permanecen en el dispositivo y no se copian
ni se eliminan al aplicar migraciones.

## Modelo y relaciones

```text
auth.users ──1:1── profiles
workspaces ──1:N── workspace_members ──N:1── profiles
workspaces ──1:N── persons ──1:N── attendances
workspaces ──1:N── nationality_colors
workspaces ──1:N── admin_activity
```

- `profiles` amplía la identidad de Supabase Auth; el ID siempre es el de
  `auth.users`. Un trigger crea el perfil al crearse una cuenta.
- `workspaces` separa los datos de cada organización. La migración crea el
  espacio inicial `CAF - Espacio compartido`; el diseño permite crear otros.
- `workspace_members` es la fuente de verdad de rol y acceso. Un usuario puede
  pertenecer a varios espacios con roles distintos. Una membresía inactiva no
  obtiene acceso. `is_owner` protege al propietario inicial y
  `invitation_accepted_at` distingue invitaciones pendientes.
- `persons` representa una persona una sola vez por espacio. No hay índices
  únicos sobre nombre, teléfono o correo; esos campos sirven para buscar
  posibles coincidencias, no para rechazar registros.
- `attendances` representa cada visita por separado. Su clave foránea compuesta
  obliga a que persona y atención pertenezcan al mismo espacio. `attended_at`
  es la fecha del proceso y `created_at` es cuándo se guardó.
- `nationality_colors` permite una asignación de color por nacionalidad y
  espacio.
- `admin_activity` conserva cambios administrativos relevantes y eliminaciones
  sin guardar datos personales de la persona en el detalle del evento.

Los IDs son UUID. Los índices cubren búsquedas e informes habituales. Para el
resumen semestral, se cuenta `COUNT(DISTINCT person_id)` por periodo para
personas diferentes y filas de `attendances` para atenciones/procesos.

## Permisos

| Operación | ADMIN activo | ATTENDANT activo |
|---|---|---|
| Leer personas, atenciones e informes del espacio | Sí | Sí |
| Crear personas y atenciones | Sí | Sí |
| Editar una persona propia | Sí | Sí |
| Editar una persona de otro creador | Sí | No |
| Editar una atención propia | Sí | Sí |
| Editar una atención de otro creador | Sí | No |
| Archivar o eliminar personas; eliminar atenciones | Sí | No |
| Consultar y administrar membresías | Sí | No |
| Cambiar colores y consultar actividad administrativa | Sí | No |

Las políticas RLS aplican a cada tabla. Funciones `SECURITY DEFINER` verifican
la membresía activa y el rol, usan `search_path` vacío y sólo son ejecutables
por usuarios autenticados. Las claves foráneas compuestas y los triggers
protegen la separación entre espacios y los campos de propiedad. No se conceden
permisos a `anon`. Los triggers impiden desactivar al propietario o al último
administrador. Las membresías se desactivan en vez de eliminarse para conservar
los registros históricos asociados a sus perfiles.

## Aplicación y primer administrador

La Supabase CLI está instalada como dependencia de desarrollo y la configuración
local vive en `supabase/config.toml`. Desde PowerShell, autentícate en tu cuenta,
vincula **el proyecto Supabase correcto** y aplica las migraciones:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <PROJECT_REF>
npx.cmd supabase db push
```

`login` solicita el token de acceso de Supabase en la terminal; `link` puede
solicitar la contraseña de la base de datos. No pegues esos valores en el chat,
en `.env.local` ni en archivos del proyecto.

La migración no crea la cuenta inicial. Crea el primer usuario desde el panel
de Supabase Auth y deshabilita el registro público. En el SQL Editor de ese
mismo proyecto asigna su membresía inicial y el rol de propietario. Reemplaza
el correo:

```sql
insert into public.workspace_members
  (workspace_id, user_id, role, is_owner, invitation_accepted_at)
select
  '11111111-1111-4111-8111-111111111111'::uuid,
  id,
  'admin',
  true,
  now()
from auth.users
where lower(email) = lower('admin@ejemplo.com')
on conflict (workspace_id, user_id)
do update set
  role = 'admin',
  is_active = true,
  is_owner = true,
  invitation_accepted_at = coalesce(
    public.workspace_members.invitation_accepted_at,
    now()
  );
```

Ejecuta esa consulta sólo en el SQL Editor autenticado del proyecto
administrado. No la expongas como endpoint ni incluyas una clave
`service_role` en el navegador.

Al migrar un proyecto que ya tenga administradores, la migración marca como
propietario al administrador activo más antiguo. Antes de aplicar `db push`,
confirma que esa sea la cuenta propietaria real. Si no lo es, corrige el
indicador `is_owner` en el SQL Editor autenticado: deja un solo propietario por
espacio. Una vez asignado, RLS/triggers no permiten a una cuenta normal cambiar
ni desactivar al propietario.

## Conexión de Auth en el frontend

1. Copia `.env.example` como `.env.local` y define `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_PUBLISHABLE_KEY` desde la configuración **del proyecto
   Supabase correcto**. Es una clave publicable, no una clave `service_role`.
2. En Supabase Auth, deshabilita **Allow new users to sign up**. También está
   deshabilitado para Supabase local en `supabase/config.toml`. El frontend no
   tiene ninguna operación pública `signUp`.
3. En Auth → URL Configuration, para desarrollo local usa como **Site URL**
   `http://127.0.0.1:5173`. Añade `http://127.0.0.1:5173/**` y
   `http://localhost:5173/**` a **Redirect URLs**. En el proyecto alojado,
   usa como **Site URL** el origen HTTPS exacto que muestre Vercel y agrega ese
   origen a Redirect URLs. No se encontró un dominio Vercel configurado en este
   repositorio, así que debe copiarse del panel; no uses un dominio supuesto.
   Las redirecciones de invitación y recuperación usan el origen actual o
   `APP_SITE_URL`.
4. En Authentication → Settings, configura la longitud mínima de contraseña
   como 6 caracteres para que coincida con la aplicación. Opcionalmente, define
   `VITE_ACCESS_REQUEST_EMAIL` en `.env.local` con un correo público al que los
   usuarios puedan solicitar acceso. Reinicia Vite tras cambiar las variables.

`src/lib/supabase.ts` crea el cliente tipado y deja que el SDK gestione la
persistencia y renovación de sesión. `src/pages/LoginPage.tsx` permite iniciar
sesión, recuperar contraseña y aceptar invitaciones anteriores; no incluye
registro público. `.env.local` está excluido por `.gitignore`.

## Administración de colaboradores

1. Asegúrate de que la cuenta inicial sea propietaria y administradora con la
   consulta del apartado anterior. Una migración marca como propietario al
   administrador activo más antiguo que ya exista.
2. Aplica la migración de baja de miembros y despliega la función de creación
   de cuentas en Supabase:

   ```powershell
   npx.cmd supabase db push --remote
   npx.cmd supabase functions deploy create-user
   ```

   Si la CLI solicita la contraseña de la base de datos, introdúcela en la
   terminal local; no la compartas por el chat.
   No se necesita SMTP ni `APP_SITE_URL` para crear cuentas. La función corre
   en Supabase Edge Functions; Vercel, si aloja la interfaz, sólo sirve la app
   web y no administra colaboradores. Supabase proporciona `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` al runtime de funciones. No las copies a
   variables `VITE_*`, al navegador, al repositorio ni al chat.
3. Inicia sesión como `admin` y abre **Configuración → Miembros del espacio**.
   Esta sección no aparece para colaboradores. Para una cuenta nueva, completa
   nombre, correo, contraseña inicial (mínimo 6 caracteres) y rol, y pulsa
   **Crear cuenta**. La cuenta queda activa de inmediato; el colaborador puede
   iniciar sesión con ese correo y contraseña, sin abrir un enlace de invitación.
   Comparte la contraseña por un canal seguro.
4. Si el correo ya existe en Supabase Auth, la aplicación ofrece **Vincular
   cuenta existente**. Esa acción agrega o reactiva la membresía en el espacio
   CAF, aplica el rol seleccionado y conserva la contraseña actual. Después, la
   persona inicia sesión con sus credenciales existentes.
5. Desde la lista, un administrador puede cambiar el rol, desactivar/reactivar
   o quitar a otro miembro del espacio. Quitar elimina únicamente la
   membresía: conserva la cuenta de Auth, el perfil y los registros históricos,
   pero la persona ya no puede acceder a este espacio. El propietario y la
   propia cuenta no se pueden quitar; el último administrador activo está
   protegido por un trigger. Desactivar conserva la membresía para poder
   reactivar el acceso.

   La función SQL `remove_workspace_member` autoriza la operación para un
   administrador activo y registra la eliminación mediante la auditoría
   existente de membresías. No se concede permiso directo de borrado a los
   usuarios autenticados.

La Edge Function `supabase/functions/create-user/index.ts` valida el JWT y
comprueba la membresía `admin` activa antes de usar la clave de servicio, que
sólo existe en el runtime de Supabase. Valida el nombre, correo, contraseña y
rol al crear cuentas; al vincular, busca el correo exacto en Auth y no solicita
ni modifica la contraseña. El ID del espacio es fijo y el cliente no puede
solicitar acceso a otro espacio. La función usa las cabeceras CORS mantenidas
por el SDK de Supabase. El registro público de Supabase Auth sigue deshabilitado.
Cuentas creadas por el flujo antiguo de invitación aún pueden completar esa
invitación.

### Prueba manual con dos cuentas

1. Aplica las migraciones, despliega la función y usa una cuenta administradora
   que ya pueda entrar al espacio.
2. Desde **Configuración → Miembros del espacio**, crea un colaborador con un
   correo que controles, contraseña y rol `Colaborador`. La lista debe mostrar
   la cuenta como **Activa**.
3. Prueba también con una cuenta Auth ya existente que aún no pertenezca al
   espacio: la acción de vinculación debe agregarla como miembro activo y
   conservar su contraseña.
4. Cierra sesión e inicia como colaborador con el correo y la contraseña
   asignados. Comprueba que puede consultar el registro compartido
   y que puede crear registros. Intenta editar un registro creado por el admin:
   la interfaz/RLS debe impedirlo. Los datos no deben mezclarse con el IndexedDB
   local de otros dispositivos.
5. Vuelve a entrar como admin, cambia el rol y prueba desactivar y reactivar al
   colaborador. Tras desactivarlo, el colaborador debe perder acceso al espacio;
   vuelve a activarlo para recuperar el acceso. Los registros históricos deben
   seguir presentes.
6. Confirma que el propietario permanece como administrador activo y que el
   registro público sigue deshabilitado en Authentication → Settings.

Estas pruebas requieren cuentas y un proyecto Supabase propios.
No se ejecutaron contra un proyecto remoto desde este entorno.

Si aún no hay una membresía activa, la app bloquea el acceso. Los registros
locales de Dexie no se mezclan ni se muestran en las pantallas compartidas.

## Verificación de membresía y rol

Después de autenticar, `src/services/workspaceService.ts` consulta sólo la fila
del usuario actual para el ID fijo del espacio inicial. La consulta corre con
la sesión del usuario, por lo que la política RLS de `workspace_members`
determina qué puede devolver. Una membresía activa aporta su rol `admin` o
`attendant`; la interfaz no usa metadatos de Auth para decidir permisos.

Si RLS no devuelve la fila (por ejemplo, usuario desactivado o no invitado), el
acceso se deniega. Los errores de consulta se presentan como error y permiten
reintentar; el estado se vuelve a verificar al recuperar el foco de la pestaña.
La autorización final seguirá perteneciendo a RLS en cada consulta de datos;
este control de interfaz no la sustituye.

Con una membresía verificada, el directorio, búsqueda, historial, registro,
estadísticas e informes usan las tablas compartidas con la sesión autenticada.
El directorio muestra acciones según el rol/creador, además de las políticas
RLS que autorizan las operaciones efectivas. La configuración ya no exporta ni
restaura los datos locales de Dexie; éstos permanecen separados.

El registro de una atención y, si corresponde, la creación/edición permitida de
la persona se ejecutan juntos en una función PostgreSQL. Las posibles
coincidencias se buscan por nombre, nacionalidad y teléfono/correo coincidente;
la persona existente sólo se reutiliza tras confirmación. No hay restricciones
únicas sobre esos datos.

`src/services/sharedData.ts` consulta personas, atenciones y perfiles en páginas
para evitar truncar los informes al límite de filas de Supabase. Los nombres de
quienes atendieron se incorporan al historial. Las agregaciones semestrales
cuentan IDs de personas distintas, pero mantienen todas las atenciones del
período.

Las migraciones adicionales actualizan la visibilidad de perfiles para los
administradores y registran en `admin_activity` los campos modificados en
personas/atenciones sin copiar valores personales al registro de auditoría.
El total semestral de personas distintas usa la función SQL
`count_distinct_attended_people`, basada en `COUNT(DISTINCT person_id)` y
ejecutada con los permisos RLS del usuario autenticado.

## Archivos principales

- `supabase/migrations/20261110220000_shared_workspace.sql`: tablas,
  relaciones, índices, trigger de perfil, auditoría, funciones auxiliares,
  RLS y privilegios.
- `supabase/migrations/20261110230000_register_attendance.sql`: registro
  transaccional de atención y persona con verificación de rol y autor.
- `supabase/migrations/20261110233000_admin_profile_visibility.sql`: permite a
  administradores consultar perfiles de miembros inactivos para administrar
  cuentas.
- `supabase/migrations/20261110234500_audit_record_edits.sql`: registra cambios
  administrativos de personas y atenciones sin duplicar datos personales.
- `supabase/migrations/20261110240000_semester_distinct_people.sql`: calcula
  personas únicas del semestre en PostgreSQL.
- `supabase/migrations/20261113230000_private_workspace_invites.sql`: protege
  al propietario, marca invitaciones aceptadas y prohíbe borrar membresías.
- `supabase/migrations/20261117223000_remove_workspace_member.sql`: habilita
  la baja administrativa auditada de miembros sin borrar perfiles ni registros.
- `supabase/functions/create-user/index.ts`: valida al administrador y crea
  cuentas con su rol desde Supabase Auth.
- `docs/SUPABASE.md`: modelo, decisiones, permisos y procedimiento inicial.
- `.env.example`: nombres de variables requeridos para conectar el frontend.
- `src/lib/supabase.ts`, `src/services/authService.ts` y `src/auth/`: cliente
  tipado, operaciones de autenticación y protección de la aplicación.
- `src/services/workspaceService.ts` y `src/auth/WorkspaceProvider.tsx`:
  verificación de membresía activa y rol en el espacio inicial.
- `src/services/personService.ts`, `attendanceService.ts` y `sharedData.ts`:
  búsqueda de posibles duplicados, registro y lectura compartida paginada.
- `src/services/userService.ts` y `src/pages/SettingsPage.tsx`: administración
  de cuentas, roles y estado.
- `src/types/database.types.ts`: tipos TypeScript del esquema Supabase.

El despliegue de migraciones y la función, la configuración de Auth y las
pruebas con cuenta admin y colaborador requieren acceso al proyecto Supabase.
No se realizaron desde este entorno.
