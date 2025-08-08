import { useState } from 'react'
import { UserEmailData } from '../../../../../../types/user-email'
import getMeta from '../../../../utils/meta'
import ReconfirmationInfoSuccess from './reconfirmation-info/reconfirmation-info-success'
import ReconfirmationInfoPromptText from './reconfirmation-info/reconfirmation-info-prompt-text'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useUserEmailsContext } from '@/features/settings/context/user-email-context'
import { ssoAvailableForInstitution } from '@/features/settings/utils/sso'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@/shared/hooks/use-location'
import OLButton from '@/shared/components/ol/ol-button'
import ResendConfirmationCodeModal from '@/features/settings/components/emails/resend-confirmation-code-modal'

type ReconfirmationInfoProps = {
  userEmailData: UserEmailData
}

function ReconfirmationInfo({ userEmailData }: ReconfirmationInfoProps) {
  const reconfirmedViaSAML = getMeta('ol-reconfirmedViaSAML')
  const affiliation = userEmailData.affiliation
  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings')
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()
  const [isPending, setIsPending] = useState(false)
  const location = useLocation()
  const ssoAvailable = Boolean(
    ssoAvailableForInstitution(affiliation?.institution ?? null)
  )

  if (!affiliation) {
    return null
  }

  if (
    userEmailData.samlProviderId &&
    userEmailData.samlProviderId === reconfirmedViaSAML
  ) {
    return (
      <OLRow>
        <OLCol lg={12}>
          <OLNotification
            type="info"
            content={
              <ReconfirmationInfoSuccess
                institution={affiliation.institution}
              />
            }
          />
        </OLCol>
      </OLRow>
    )
  }

  if (!affiliation.inReconfirmNotificationPeriod) {
    return null
  }

  return (
    <OLNotification
      type="info"
      content={
        <ReconfirmationInfoPromptText
          institutionName={affiliation.institution.name}
          primary={userEmailData.default}
        />
      }
      action={
        affiliation?.institution && ssoAvailable ? (
          <OLButton
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              setIsPending(true)
              location.assign(
                `${samlInitPath}?university_id=${affiliation.institution.id}&reconfirm=/user/settings`
              )
            }}
          >
            {t('confirm_affiliation')}
          </OLButton>
        ) : (
          <ResendConfirmationCodeModal
            email={userEmailData.email}
            setGroupLoading={setUserEmailsContextLoading}
            groupLoading={state.isLoading}
            onSuccess={getEmails}
            triggerVariant="secondary"
          />
        )
      }
    />
  )
}

export default ReconfirmationInfo
