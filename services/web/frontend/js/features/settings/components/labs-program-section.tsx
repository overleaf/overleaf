import { useTranslation } from 'react-i18next'
import { useUserContext } from '../../../shared/context/user-context'

function LabsProgramSection() {
  const { t } = useTranslation()
  const { labsProgram } = useUserContext()

  const labsStatusText = labsProgram
    ? t('youre_a_member_of_overleaf_labs')
    : t('get_exclusive_access_to_labs')
  const labsRedirectText = labsProgram
    ? t('view_labs_experiments')
    : t('join_overleaf_labs')

  return (
    <>
      <h3>{t('overleaf_labs')}</h3>

      <p className="small">{labsStatusText}</p>

      <a href="/labs/participate">{labsRedirectText}</a>
      <hr />
    </>
  )
}

export default LabsProgramSection
