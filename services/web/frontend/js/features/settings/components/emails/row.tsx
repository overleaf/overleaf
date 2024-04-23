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
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import { ssoAvailableForInstitution } from '../../utils/sso'
import ReconfirmationInfo from './reconfirmation-info'
import { useLocation } from '../../../../shared/hooks/use-location'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import ColWrapper from '@/features/ui/components/bootstrap-5/wrappers/col-wrapper'
import { bsVersion } from '@/features/utils/bootstrap-5'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

type EmailsRowProps = {
  userEmailData: UserEmailData
}

function EmailsRow({ userEmailData }: EmailsRowProps) {
  const hasSSOAffiliation = Boolean(
    userEmailData.affiliation &&
      ssoAvailableForInstitution(userEmailData.affiliation.institution)
  )

  return (
    <>
      <RowWrapper>
        <ColWrapper md={4}>
          <EmailCell>
            <Email userEmailData={userEmailData} />
          </EmailCell>
        </ColWrapper>
        <ColWrapper md={5}>
          {userEmailData.affiliation?.institution && (
            <EmailCell>
              <InstitutionAndRole userEmailData={userEmailData} />
            </EmailCell>
          )}
        </ColWrapper>
        <ColWrapper md={3}>
          <EmailCell
            className={bsVersion({
              bs5: 'text-md-end',
              bs3: 'text-md-right',
            })}
          >
            <Actions userEmailData={userEmailData} />
          </EmailCell>
        </ColWrapper>
      </RowWrapper>

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
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
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
      <RowWrapper>
        <ColWrapper md={{ span: 8, offset: 4 }}>
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
        </ColWrapper>
      </RowWrapper>
    )
  }

  return (
    <RowWrapper>
      <ColWrapper md={{ span: 8, offset: 4 }}>
        <div className="horizontal-divider" />
        <RowWrapper>
          <ColWrapper md={9}>
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
          </ColWrapper>
          <ColWrapper
            md={3}
            className={bsVersion({
              bs5: 'text-md-end',
              bs3: 'text-md-right',
            })}
          >
            <EmailCell>
              <ButtonWrapper
                variant="primary"
                className="btn-link-accounts"
                disabled={linkAccountsButtonDisabled}
                onClick={handleLinkAccountsButtonClick}
                size="small"
              >
                {t('link_accounts')}
              </ButtonWrapper>
            </EmailCell>
          </ColWrapper>
        </RowWrapper>
      </ColWrapper>
    </RowWrapper>
  )
}

export default EmailsRow
