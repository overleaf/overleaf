import { useTranslation } from 'react-i18next'

function SessionsSection() {
  const { t } = useTranslation()

  return (
    <>
      <h3>{t('sessions')}</h3>
      <a href="/user/sessions">{t('manage_sessions')}</a>
    </>
  )
}

export default SessionsSection
