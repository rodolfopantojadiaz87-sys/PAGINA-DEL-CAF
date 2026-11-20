-- Los miembros se crean ya activos desde la Edge Function create-user, con su
-- contraseña y rol. El flujo de invitación por correo ya no existe, así que se
-- elimina la función que aceptaba invitaciones.
drop function if exists public.accept_workspace_invitation();
