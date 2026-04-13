import { useTranslation } from 'react-i18next'

export default function RecaptchaConditions() {
  const { t } = useTranslation()
  return <div className="recaptcha-branding">{t('recaptcha_conditions')}</div>
}
