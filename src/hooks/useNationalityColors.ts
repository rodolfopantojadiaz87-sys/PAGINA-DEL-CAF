import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../database/database'
import { ensureNationalityColors } from '../services/nationalityColors'
import type { NationalityColor } from '../types/records'

export function useNationalityColors(labels: string[]): {
  colors: NationalityColor[]
  error: string
  ready: boolean
} {
  const labelsKey = useMemo(
    () => JSON.stringify([...new Set(labels)].sort()),
    [labels],
  )
  const labelsToEnsure = useMemo(
    () => JSON.parse(labelsKey) as string[],
    [labelsKey],
  )
  const [error, setError] = useState('')
  const colors = useLiveQuery(
    () => database.nationalityColors.toArray(),
    [],
    [],
  )

  useEffect(() => {
    let active = true
    ensureNationalityColors(labelsToEnsure).then(
      () => {
        if (active) setError('')
      },
      (caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudieron guardar los colores de las nacionalidades.',
          )
        }
      },
    )
    return () => {
      active = false
    }
  }, [labelsToEnsure])

  const ready = labelsToEnsure.every((label) =>
    colors.some(
      (entry) => entry.nationality === label.trim().toLocaleLowerCase(),
    ),
  )

  return { colors, error, ready }
}
