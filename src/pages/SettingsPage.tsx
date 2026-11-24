import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Trash2, UserPlus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { FormAlert } from '../components/FormAlert'
import { PageHeader } from '../components/PageHeader'
import { PersonAvatar } from '../components/PersonAvatar'
import { SelectField } from '../components/SelectField'
import { useI18n } from '../i18n'
import {
  createWorkspaceUser,
  listWorkspaceUsers,
  removeWorkspaceMember,
  updateWorkspaceMember,
  type WorkspaceUser,
} from '../services/userService'
import { SHARED_WORKSPACE_ID } from '../constants/workspace'
import { capitalizeWords } from '../utils/textFormatting'

/** Miembros del espacio: alta con contraseña y rol, cambio de rol, desactivar y quitar. */
export function SettingsPage() {
  const { t } = useI18n()
  const { access } = useWorkspace()
  const { user } = useAuth()
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const [members, setMembers] = useState<WorkspaceUser[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<WorkspaceUser['role']>('attendant')
  const [showPassword, setShowPassword] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string>()
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceUser | null>(null)

  const loadMembers = useCallback(() => listWorkspaceUsers(SHARED_WORKSPACE_ID), [])

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    loadMembers()
      .then((nextMembers) => {
        if (!active) return
        setMembers(nextMembers)
        setMembersError('')
      })
      .catch((loadError: unknown) => {
        if (active) setMembersError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo.')
      })
      .finally(() => {
        if (active) setMembersLoaded(true)
      })
    return () => {
      active = false
    }
  }, [isAdmin, loadMembers])

  async function refreshMembers() {
    try {
      setMembers(await loadMembers())
    } catch (loadError: unknown) {
      setMembersError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo.')
    }
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateBusy(true)
    setCreateError('')
    setNotice('')
    try {
      await createWorkspaceUser(newMemberName, newMemberEmail, newMemberPassword, newMemberRole)
      setNotice(t('{name} ya puede entrar con {email} y la contraseña que elegiste.', { name: newMemberName.trim(), email: newMemberEmail.trim() }))
      setNewMemberName('')
      setNewMemberEmail('')
      setNewMemberPassword('')
      setNewMemberRole('attendant')
      setShowPassword(false)
      await refreshMembers()
    } catch (caught: unknown) {
      setCreateError(caught instanceof Error ? caught.message : 'No se pudo crear el miembro.')
    } finally {
      setCreateBusy(false)
    }
  }

  async function changeMember(member: WorkspaceUser, changes: { role?: WorkspaceUser['role']; is_active?: boolean }) {
    setUpdatingMemberId(member.id)
    setMembersError('')
    setNotice('')
    try {
      await updateWorkspaceMember(SHARED_WORKSPACE_ID, member.id, {
        role: changes.role ?? member.role,
        is_active: changes.is_active ?? member.is_active,
      })
      await refreshMembers()
    } catch (caught: unknown) {
      setMembersError(caught instanceof Error ? caught.message : 'No se pudo actualizar el permiso.')
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  async function removeMember() {
    const member = memberToRemove
    if (!member) return
    setUpdatingMemberId(member.id)
    setMembersError('')
    try {
      await removeWorkspaceMember(SHARED_WORKSPACE_ID, member.id)
      setMembers((current) => current.filter(({ id }) => id !== member.id))
      setMemberToRemove(null)
      setNotice(t('{name} ya no tiene acceso. Sus registros se conservan.', { name: member.full_name }))
    } catch (caught: unknown) {
      setMembersError(caught instanceof Error ? caught.message : 'No se pudo quitar el colaborador.')
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  const removingMember = memberToRemove !== null && updatingMemberId === memberToRemove.id

  return (
    <div className="space-y-6">
      <PageHeader title={t('Miembros')} description={t('Quién puede entrar al sistema y qué puede hacer.')} />

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{t('Crear miembro')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleCreateMember(event)}>
              <div className="grid gap-2">
                <Label htmlFor="member-name">{t('Nombre y apellido')}</Label>
                <Input autoCapitalize="words" autoComplete="off" disabled={createBusy} id="member-name" maxLength={120} onChange={(event) => setNewMemberName(capitalizeWords(event.target.value))} required type="text" value={newMemberName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-email">{t('Correo electrónico')}</Label>
                <Input autoComplete="off" disabled={createBusy} id="member-email" onChange={(event) => { setNewMemberEmail(event.target.value); setNotice('') }} placeholder={t('nombre@ejemplo.com')} required type="email" value={newMemberEmail} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-password">{t('Contraseña')}</Label>
                <div className="relative">
                  <Input autoComplete="new-password" className="pr-10" disabled={createBusy} id="member-password" minLength={6} onChange={(event) => setNewMemberPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={newMemberPassword} />
                  <Button aria-label={t(showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña')} className="absolute top-0 right-0 text-muted-foreground" disabled={createBusy} onClick={() => setShowPassword((visible) => !visible)} size="icon" type="button" variant="ghost">
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('Mínimo 6 caracteres. Compártela con la persona por un canal seguro: no se vuelve a mostrar.')}</p>
              </div>
              <div className="grid gap-2">
                <Label>{t('Rol')}</Label>
                <RadioGroup aria-label={t('Rol')} disabled={createBusy} onValueChange={(value) => setNewMemberRole(value === 'admin' ? 'admin' : 'attendant')} value={newMemberRole}>
                  {([
                    ['attendant', 'Colaborador', 'Registra atenciones y consulta personas e informes.'],
                    ['admin', 'Administrador', 'Además edita cualquier dato, elimina personas y gestiona miembros.'],
                  ] as const).map(([value, title, description]) => (
                    <Label
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                      htmlFor={`role-${value}`}
                      key={value}
                    >
                      <RadioGroupItem className="mt-0.5" id={`role-${value}`} value={value} />
                      <span className="grid gap-1">
                        <span className="font-medium">{t(title)}</span>
                        <span className="text-xs leading-snug text-muted-foreground">{t(description)}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              {createError && <FormAlert>{t(createError)}</FormAlert>}
              <Button className="w-full" disabled={createBusy} type="submit">
                <UserPlus aria-hidden="true" />{createBusy ? t('Creando miembro…') : t('Crear miembro')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-0 shadow-none">
          <CardHeader className="border-b">
            <CardTitle>{t('Equipo')}</CardTitle>
            <CardDescription>{membersLoaded ? t('{count} miembros', { count: members.length }) : t('Cargando…')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {(notice || (membersError && !memberToRemove)) && (
              <div className="space-y-2 px-6 pt-4">
                {notice && <FormAlert kind="success">{notice}</FormAlert>}
                {membersError && !memberToRemove && <FormAlert>{t(membersError)}</FormAlert>}
              </div>
            )}
            <ul className="divide-y">
              {members.map((member) => {
                const isSelf = member.user_id === user?.id
                const protectedMember = member.is_owner || isSelf
                const busy = updatingMemberId === member.id
                return (
                  <li className={cn('flex flex-wrap items-center gap-3 px-6 py-4', !member.is_active && 'opacity-60')} key={member.id}>
                    <PersonAvatar name={member.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {member.full_name}
                        {isSelf && <span className="font-normal text-muted-foreground">{t('(tú)')}</span>}
                        {member.is_owner && <Badge variant="secondary">{t('Propietario')}</Badge>}
                        {!member.is_active && <Badge variant="outline">{t('Desactivado')}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email ?? t('Correo no disponible')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <SelectField
                        className="w-40"
                        disabled={protectedMember || busy}
                        hideLabel
                        label={t('Rol de {name}', { name: member.full_name })}
                        onChange={(value) => void changeMember(member, { role: value === 'admin' ? 'admin' : 'attendant' })}
                        options={[{ value: 'attendant', label: t('Colaborador') }, { value: 'admin', label: t('Administrador') }]}
                        value={member.role}
                      />
                      {!protectedMember && (
                        <>
                          <Button disabled={busy} onClick={() => void changeMember(member, { is_active: !member.is_active })} size="sm" variant="ghost">
                            {busy ? t('Guardando…') : member.is_active ? t('Desactivar') : t('Reactivar')}
                          </Button>
                          <Button aria-label={t('Quitar a {name} del espacio', { name: member.full_name })} className="text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => { setMembersError(''); setMemberToRemove(member) }} size="icon" title={t('Quitar del espacio')} variant="ghost">
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <AlertDialog onOpenChange={(open) => { if (!open && !removingMember) setMemberToRemove(null) }} open={memberToRemove !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Quitar del espacio')}</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove && t('{name} dejará de tener acceso. Sus registros se conservan, y puedes volver a crearlo con el mismo correo más adelante.', { name: memberToRemove.full_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {membersError && <FormAlert>{t(membersError)}</FormAlert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>{t('Cancelar')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removingMember} onClick={(event) => { event.preventDefault(); void removeMember() }}>
              <Trash2 aria-hidden="true" />{removingMember ? t('Quitando…') : t('Quitar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
