import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import ResendConfirmationEmailButton from './resend-confirmation-email-button'
import { ssoAvailableForInstitution } from '../../utils/sso'
import OLBadge from '@/features/ui/components/ol/ol-badge'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type EmailProps = {
  userEmailData: UserEmailData
}

function Email({ userEmailData }: EmailProps) {
  const { t } = useTranslation()

  const ssoAvailable = ssoAvailableForInstitution(
    userEmailData.affiliation?.institution || null
  )

  const isPrimary = userEmailData.default
  const isProfessional =
    userEmailData.confirmedAt &&
    userEmailData.affiliation?.institution.confirmed &&
    userEmailData.affiliation.licence !== 'free'
  const hasBadges = isPrimary || isProfessional

  return (
    <>
      {userEmailData.email}
      {!userEmailData.confirmedAt && (
        <div className="small">
          <strong>
            {t('unconfirmed')}.
            {!ssoAvailable && <span> {t('please_check_your_inbox')}.</span>}
          </strong>
          <br />
          {!ssoAvailable && (
            <ResendConfirmationEmailButton email={userEmailData.email} />
          )}
        </div>
      )}
      {hasBadges && (
        <div className={classnames({ small: !isBootstrap5() })}>
          {isPrimary && (
            <>
              <OLBadge bg="info">Primary</OLBadge>{' '}
            </>
          )}
          {isProfessional && (
            <OLBadge bg="primary">{t('professional')}</OLBadge>
          )}
        </div>
      )}
    </>
  )
}

export default Email
