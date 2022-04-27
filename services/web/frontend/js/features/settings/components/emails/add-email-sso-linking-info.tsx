import { Trans, useTranslation } from 'react-i18next'
import { InstitutionInfo } from './add-email-input'
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import getMeta from '../../../../utils/meta'

type AddEmailSSOLinkingInfoProps = {
  institutionInfo: InstitutionInfo
  email: string
}

export function AddEmailSSOLinkingInfo({
  institutionInfo,
  email,
}: AddEmailSSOLinkingInfoProps) {
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
  const { t } = useTranslation()

  return (
    <>
      <p className="affiliations-table-label">
        {institutionInfo.university.name}
      </p>
      <p>
        <Trans
          i18nKey="to_add_email_accounts_need_to_be_linked_2"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{ institutionName: institutionInfo.university.name }}
        />
      </p>
      <p>
        <Trans
          i18nKey="doing_this_will_verify_affiliation_and_allow_log_in_2"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{ institutionName: institutionInfo.university.name }}
        />{' '}
        <a
          href="/learn/how-to/Institutional_Login"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('find_out_more_about_institution_login')}.
        </a>
      </p>
      <a
        className="btn-sm btn btn-primary btn-link-accounts"
        href={`${samlInitPath}?university_id=${institutionInfo.university.id}&auto=/user/settings&email=${email}`}
      >
        {t('link_accounts_and_add_email')}
      </a>
    </>
  )
}
