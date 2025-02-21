import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import Email from './email'
import InstitutionAndRole from './institution-and-role'
import EmailCell from './cell'
import Actions from './actions'
import { institutionAlreadyLinked } from '../../utils/selectors'
import { useUserEmailsContext } from '../../context/user-email-context'
import getMeta from '../../../../utils/meta'
import { ssoAvailableForInstitution } from '../../utils/sso'
import ReconfirmationInfo from './reconfirmation-info'
import { useLocation } from '../../../../shared/hooks/use-location'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLButton from '@/features/ui/components/ol/ol-button'

type EmailsRowProps = {
  userEmailData: UserEmailData
  primary?: UserEmailData
}

function EmailsRow({ userEmailData, primary }: EmailsRowProps) {
  const hasSSOAffiliation = Boolean(
    userEmailData.affiliation &&
      ssoAvailableForInstitution(userEmailData.affiliation.institution)
  )

  return (
    <>
      <OLRow>
        <OLCol lg={4}>
          <EmailCell>
            <Email userEmailData={userEmailData} />
          </EmailCell>
        </OLCol>
        <OLCol lg={5}>
          {userEmailData.affiliation?.institution && (
            <EmailCell>
              <InstitutionAndRole userEmailData={userEmailData} />
            </EmailCell>
          )}
        </OLCol>
        <OLCol lg={3}>
          <EmailCell className="text-lg-end">
            <Actions userEmailData={userEmailData} primary={primary} />
          </EmailCell>
        </OLCol>
      </OLRow>

      {hasSSOAffiliation && (
        <SSOAffiliationInfo userEmailData={userEmailData} />
      )}
      <ReconfirmationInfo userEmailData={userEmailData} />
    </>
  )
}

type SSOAffiliationInfoProps = {
  userEmailData: UserEmailData
}

function SSOAffiliationInfo({ userEmailData }: SSOAffiliationInfoProps) {
  const { samlInitPath } = getMeta('ol-ExposedSettings')
  const { t } = useTranslation()
  const { state } = useUserEmailsContext()
  const location = useLocation()

  const [linkAccountsButtonDisabled, setLinkAccountsButtonDisabled] =
    useState(false)

  function handleLinkAccountsButtonClick() {
    setLinkAccountsButtonDisabled(true)
    location.assign(
      `${samlInitPath}?university_id=${userEmailData.affiliation?.institution?.id}&auto=/user/settings&email=${userEmailData.email}`
    )
  }

  if (
    !userEmailData.samlProviderId &&
    institutionAlreadyLinked(state, userEmailData)
  ) {
    // if the email is not linked to the institution, but there's another email already linked to that institution
    // no SSO affiliation is displayed, since cannot have multiple emails linked to the same institution
    return null
  }

  if (userEmailData.samlProviderId) {
    return (
      <OLRow>
        <OLCol lg={{ span: 8, offset: 4 }}>
          <EmailCell>
            <p>
              <Trans
                i18nKey="acct_linked_to_institution_acct_2"
                components={
                  /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                  [<strong />]
                }
                values={{
                  institutionName: userEmailData.affiliation?.institution.name,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />
            </p>
          </EmailCell>
        </OLCol>
      </OLRow>
    )
  }

  return (
    <OLRow>
      <OLCol lg={{ span: 8, offset: 4 }}>
        <div className="horizontal-divider" />
        <OLRow>
          <OLCol lg={9}>
            <EmailCell>
              <p className="small">
                <Trans
                  i18nKey="can_link_your_institution_acct_2"
                  values={{
                    institutionName:
                      userEmailData.affiliation?.institution.name,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    [<strong />]
                  }
                />
              </p>
              <p className="small">
                <Trans
                  i18nKey="doing_this_allow_log_in_through_institution_2"
                  components={
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    [<strong />]
                  }
                />{' '}
                <a href="/learn/how-to/Institutional_Login" target="_blank">
                  {t('find_out_more_about_institution_login')}
                </a>
              </p>
            </EmailCell>
          </OLCol>
          <OLCol lg={3} className="text-lg-end">
            <EmailCell>
              <OLButton
                variant="primary"
                className="btn-link-accounts"
                disabled={linkAccountsButtonDisabled}
                onClick={handleLinkAccountsButtonClick}
                size="sm"
              >
                {t('link_accounts')}
              </OLButton>
            </EmailCell>
          </OLCol>
        </OLRow>
      </OLCol>
    </OLRow>
  )
}

export default EmailsRow
