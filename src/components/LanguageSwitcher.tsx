import { useI18n } from '../i18n'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()

  return (
    <label className="language-switcher">
      <span className="visually-hidden">{t('Idioma')}</span>
      <select
        aria-label={t('Idioma')}
        onChange={(event) => setLanguage(event.target.value === 'pt' ? 'pt' : 'es')}
        value={language}
      >
        <option value="es">{t('Español')}</option>
        <option value="pt">{t('Português')}</option>
      </select>
    </label>
  )
}
