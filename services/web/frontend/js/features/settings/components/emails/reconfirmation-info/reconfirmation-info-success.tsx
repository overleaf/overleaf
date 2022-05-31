import { Trans, useTranslation } from 'react-i18next'
import { Institution } from '../../../../../../../types/institution'

type ReconfirmationInfoSuccessProps = {
  institution: Institution
}

function ReconfirmationInfoSuccess({
  institution,
}: ReconfirmationInfoSuccessProps) {
  const { t } = useTranslation()
  return (
    <div>
      <Trans
        i18nKey="your_affiliation_is_confirmed"
        values={{
          institutionName: institution.name,
        }}
        components={
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          [<strong />]
        }
      />{' '}
      {t('thank_you_exclamation')}
    </div>
  )
}

export default ReconfirmationInfoSuccess
