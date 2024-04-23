import { Trans, useTranslation } from 'react-i18next'
import { Institution } from '../../../../../../../types/institution'

type ReconfirmationInfoPromptTextProps = {
  primary: boolean
  institutionName: Institution['name']
  icon?: React.ReactElement // BS3 only
}

function ReconfirmationInfoPromptText({
  primary,
  institutionName,
  icon,
}: ReconfirmationInfoPromptTextProps) {
  const { t } = useTranslation()

  return (
    <>
      {icon}
      <Trans
        i18nKey="are_you_still_at"
        values={{
          institutionName,
        }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
        components={
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          [<strong />]
        }
      />{' '}
      <Trans
        i18nKey="please_reconfirm_institutional_email"
        components={
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          [<span />]
        }
      />{' '}
      <a
        href="/learn/how-to/Institutional_Email_Reconfirmation"
        target="_blank"
      >
        {t('learn_more')}
      </a>
      <br />
      {primary ? <i>{t('need_to_add_new_primary_before_remove')}</i> : null}
    </>
  )
}

export default ReconfirmationInfoPromptText
