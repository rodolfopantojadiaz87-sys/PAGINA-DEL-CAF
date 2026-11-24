import { useI18n } from '../i18n'
import { SelectField } from './SelectField'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()

  return (
    <SelectField
      className="w-36"
      hideLabel
      label={t('Idioma')}
      onChange={(value) => setLanguage(value === 'pt' ? 'pt' : 'es')}
      options={[{ value: 'es', label: t('Español') }, { value: 'pt', label: t('Português') }]}
      value={language}
    />
  )
}
