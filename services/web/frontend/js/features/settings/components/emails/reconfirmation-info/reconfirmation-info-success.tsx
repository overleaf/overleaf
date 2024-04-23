import { Trans, useTranslation } from 'react-i18next'
import { Institution } from '../../../../../../../types/institution'

type ReconfirmationInfoSuccessProps = {
  institution: Institution
  className?: string
}

function ReconfirmationInfoSuccess({
  institution,
  className,
}: ReconfirmationInfoSuccessProps) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <div>
        <Trans
          i18nKey="your_affiliation_is_confirmed"
          values={{ institutionName: institution.name }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[<strong />]} // eslint-disable-line react/jsx-key
        />{' '}
        {t('thank_you_exclamation')}
      </div>
    </div>
  )
}

export default ReconfirmationInfoSuccess
