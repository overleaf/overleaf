import { useTranslation } from 'react-i18next'
import { useUserContext } from '../../../shared/context/user-context'

function MiscSection() {
  const { t } = useTranslation()
  const { betaProgram } = useUserContext()

  return (
    <>
      <h3>{t('sharelatex_beta_program')}</h3>
      <p>
        {betaProgram
          ? t('beta_program_already_participating')
          : t('beta_program_benefits')}
      </p>
      <a href="/beta/participate">{t('manage_beta_program_membership')}</a>
      <hr />
      <h3>{t('sessions')}</h3>
      <a href="/user/sessions">{t('manage_sessions')}</a>
      <hr />
      <h3>{t('newsletter')}</h3>
      <a href="/user/email-preferences">{t('manage_newsletter')}</a>
    </>
  )
}

export default MiscSection
