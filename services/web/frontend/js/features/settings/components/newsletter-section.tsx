import { useTranslation } from 'react-i18next'

function NewsletterSection() {
  const { t } = useTranslation()

  return (
    <>
      <h3>{t('newsletter')}</h3>
      <a href="/user/email-preferences">{t('manage_newsletter')}</a>
    </>
  )
}

export default NewsletterSection
