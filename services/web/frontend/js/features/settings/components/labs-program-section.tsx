import { useTranslation, Trans } from 'react-i18next'
import { useUserContext } from '../../../shared/context/user-context'

function LabsProgramSection() {
  const { t } = useTranslation()
  const { labsProgram } = useUserContext()

  return (
    <>
      <h3>{t('overleaf_labs')}</h3>
      {labsProgram ? null : (
        <p className="small">
          <Trans i18nKey="labs_program_benefits">
            <span />
          </Trans>
        </p>
      )}
      <p className="small">
        {labsProgram
          ? t('labs_program_already_participating')
          : t('labs_program_not_participating')}
      </p>
      <a href="/labs/participate">{t('manage_labs_program_membership')}</a>
    </>
  )
}

export default LabsProgramSection
