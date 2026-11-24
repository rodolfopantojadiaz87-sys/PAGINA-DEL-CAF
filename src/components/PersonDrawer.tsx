import { useState, type FormEvent, type ReactNode } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, useI18n } from '../i18n'
import { formatDate } from '../lib/dates'
import { deleteSharedPerson, updateSharedPerson } from '../services/personService'
import type { Person, PersonWithHistory } from '../types/records'
import { capitalizeWords } from '../utils/textFormatting'
import { FormAlert } from './FormAlert'
import { HistoryList } from './HistoryList'
import { PersonAvatar } from './PersonAvatar'

interface PersonDrawerProps {
  personId: string
  onClose: () => void
  onRegister: (person: PersonWithHistory) => void
}

/** Ficha de una persona: contacto, historial completo y acciones. */
export function PersonDrawer({ personId, onClose, onRegister }: PersonDrawerProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { access } = useWorkspace()
  const { peopleById, refresh } = useAttendanceData()
  const person = peopleById.get(personId)
  const [editing, setEditing] = useState<Person | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const canEdit = Boolean(person && (isAdmin || person.createdBy === user?.id))

  if (!person) return null

  const first = person.appointments[person.appointments.length - 1]
  const last = person.appointments[0]

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !workspaceId || !user) return
    setBusy(true)
    setError('')
    try {
      await updateSharedPerson(workspaceId, user.id, editing)
      setEditing(null)
      refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron guardar los cambios.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!workspaceId || !person || typeof person.id !== 'string') return
    setBusy(true)
    setError('')
    try {
      await deleteSharedPerson(workspaceId, person.id)
      refresh()
      setConfirmDelete(false)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la persona.')
      setConfirmDelete(false)
      setBusy(false)
    }
  }

  const facts: { label: string; value: ReactNode }[] = [
    { label: t('Teléfono'), value: person.phone ? <a className="inline-flex items-center gap-1.5 hover:underline" href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}><Phone className="size-3.5" aria-hidden="true" />{person.phone}</a> : '—' },
    { label: t('Correo'), value: person.email ? <a className="inline-flex items-center gap-1.5 break-all hover:underline" href={`mailto:${person.email}`}><Mail className="size-3.5 shrink-0" aria-hidden="true" />{person.email}</a> : '—' },
    { label: t('Atenciones'), value: person.appointments.length },
    { label: t('Primera visita'), value: first ? formatDate(first.date, locale) : '—' },
    { label: t('Última visita'), value: last ? formatDate(last.date, locale) : '—' },
  ]

  return (
    <Sheet onOpenChange={(open) => { if (!open) onClose() }} open>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md" closeLabel={t('Cerrar')}>
        <SheetHeader className="flex-row items-center gap-3 border-b pr-12">
          <PersonAvatar className="size-12 text-base" name={person.name} />
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg">{person.name}</SheetTitle>
            <SheetDescription>{person.nationality}</SheetDescription>
          </div>
        </SheetHeader>

        {editing ? (
          <form className="space-y-4 p-4" onSubmit={(event) => void save(event)}>
            <h3 className="font-medium">{t('Editar datos')}</h3>
            <div className="grid gap-2"><Label htmlFor="edit-name">{t('Nombre completo')}</Label><Input autoCapitalize="words" id="edit-name" maxLength={120} onChange={(event) => setEditing({ ...editing, name: capitalizeWords(event.target.value) })} required value={editing.name} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-nationality">{t('Nacionalidad')}</Label><Input autoCapitalize="words" id="edit-nationality" maxLength={80} onChange={(event) => setEditing({ ...editing, nationality: capitalizeWords(event.target.value) })} required value={editing.nationality} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-phone">{t('Teléfono')}</Label><Input id="edit-phone" maxLength={40} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} type="tel" value={editing.phone} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-email">{t('Correo electrónico')}</Label><Input id="edit-email" maxLength={160} onChange={(event) => setEditing({ ...editing, email: event.target.value })} type="email" value={editing.email} /></div>
            {error && <FormAlert>{t(error)}</FormAlert>}
            <div className="flex gap-2">
              <Button disabled={busy} type="submit">{busy ? t('Guardando…') : t('Guardar cambios')}</Button>
              <Button disabled={busy} onClick={() => { setEditing(null); setError('') }} type="button" variant="ghost">{t('Cancelar')}</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-4 p-4">
              <Button className="w-full" onClick={() => onRegister(person)} size="lg">
                <Plus aria-hidden="true" />{t('Registrar atención')}
              </Button>
              <dl className="divide-y rounded-lg border text-sm">
                {facts.map(({ label, value }) => (
                  <div className="flex items-center justify-between gap-4 px-3 py-2" key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Separator />
            <div className="space-y-4 p-4">
              <h3 className="font-medium">{t('Historial')}</h3>
              <HistoryList appointments={person.appointments} />
            </div>
            {(canEdit || isAdmin) && (
              <div className="mt-auto space-y-3 border-t p-4">
                {error && <FormAlert>{t(error)}</FormAlert>}
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <Button onClick={() => { setEditing({ id: person.id, name: person.name, nationality: person.nationality, phone: person.phone, email: person.email }); setError('') }} variant="outline">
                      <Pencil aria-hidden="true" />{t('Editar datos')}
                    </Button>
                  )}
                  {isAdmin && (
                    <Button className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} variant="ghost">
                      <Trash2 aria-hidden="true" />{t('Eliminar')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <AlertDialog onOpenChange={(open) => { if (!busy) setConfirmDelete(open) }} open={confirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Eliminar')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('¿Eliminar a {name} y sus {count} atenciones? No se puede deshacer.', { name: person.name, count: person.appointments.length })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t('Cancelar')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void remove() }}>
                {busy ? t('Eliminando…') : t('Eliminar definitivamente')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
