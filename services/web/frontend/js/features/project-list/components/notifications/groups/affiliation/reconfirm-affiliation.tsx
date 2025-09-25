import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../../../utils/meta'
import { UserEmailData } from '../../../../../../../../types/user-email'
import { Institution } from '../../../../../../../../types/institution'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import OLButton from '@/shared/components/ol/ol-button'
import Notification from '@/features/project-list/components/notifications/notification'
import ResendConfirmationCodeModal from '@/features/settings/components/emails/resend-confirmation-code-modal'

type ReconfirmAffiliationProps = {
  email: UserEmailData['email']
  institution: Institution
}

function ReconfirmAffiliation({
  email,
  institution,
}: ReconfirmAffiliationProps) {
  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const ssoEnabled = institution.ssoEnabled
  const location = useLocation()

  if (isSuccess) return null
  return (
    <Notification
      type="info"
      content={
        <>
          <Trans
            i18nKey="are_you_still_at"
            components={[<b />]} // eslint-disable-line react/jsx-key
            values={{ institutionName: institution.name }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
          &nbsp;
          <Trans
            i18nKey="please_reconfirm_institutional_email"
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            components={[<a href={`/user/settings?remove=${email}`} />]}
          />
          &nbsp;
          <a
            href="/learn/how-to/Institutional_Email_Reconfirmation"
            target="_blank"
          >
            {t('learn_more_about_email_reconfirmation')}
          </a>
        </>
      }
      action={
        ssoEnabled ? (
          <OLButton
            variant="secondary"
            isLoading={isPending}
            loadingLabel={t('reconfirming')}
            disabled={isPending}
            onClick={() => {
              setIsPending(true)
              location.assign(
                `${samlInitPath}?university_id=${institution.id}&reconfirm=/project`
              )
            }}
          >
            {t('confirm_affiliation')}
          </OLButton>
        ) : (
          <ResendConfirmationCodeModal
            email={email}
            setGroupLoading={setIsLoading}
            groupLoading={isLoading}
            onSuccess={() => setIsSuccess(true)}
            triggerVariant="secondary"
          />
        )
      }
    />
  )
}

export default ReconfirmAffiliation
