import { Trans, useTranslation } from 'react-i18next'
import { useUserContext } from '../../../shared/context/user-context'

function BetaProgramSection() {
  const { t } = useTranslation()
  const { betaProgram } = useUserContext()

  return (
    <>
      <h3>{t('sharelatex_beta_program')}</h3>
      {betaProgram ? null : (
        <p className="small">
          {/* eslint-disable-next-line react/jsx-key */}
          <Trans i18nKey="beta_program_benefits" components={[<span />]} />
        </p>
      )}
      <p className="small">
        {betaProgram
          ? t('beta_program_already_participating')
          : t('beta_program_not_participating')}
      </p>
      <a href="/beta/participate">{t('manage_beta_program_membership')}</a>
    </>
  )
}

export default BetaProgramSection
