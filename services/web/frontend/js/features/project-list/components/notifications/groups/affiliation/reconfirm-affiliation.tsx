import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../../../utils/meta'
import useAsync from '../../../../../../shared/hooks/use-async'
import {
  FetchError,
  postJSON,
} from '../../../../../../infrastructure/fetch-json'
import { UserEmailData } from '../../../../../../../../types/user-email'
import { Institution } from '../../../../../../../../types/institution'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/features/ui/components/ol/ol-button'
import Notification from '@/features/project-list/components/notifications/notification'

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
  const { error, isLoading, isError, isSuccess, runAsync } = useAsync()
  const [hasSent, setHasSent] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const ssoEnabled = institution.ssoEnabled
  const location = useLocation()

  useEffect(() => {
    if (isSuccess) {
      setHasSent(true)
    }
  }, [isSuccess])

  const handleRequestReconfirmation = () => {
    if (ssoEnabled) {
      setIsPending(true)
      location.assign(
        `${samlInitPath}?university_id=${institution.id}&reconfirm=/project`
      )
    } else {
      runAsync(
        postJSON('/user/emails/send-reconfirmation', {
          body: { email },
        })
      ).catch(debugConsole.error)
    }
  }

  const rateLimited =
    error && error instanceof FetchError && error.response?.status === 429

  if (hasSent) {
    return (
      <Notification
        type="info"
        content={
          <>
            <Trans
              i18nKey="please_check_your_inbox_to_confirm"
              components={[<b />]} // eslint-disable-line react/jsx-key
              values={{ institutionName: institution.name }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
            &nbsp;
            {isError && (
              <>
                <br />
                <div>
                  {rateLimited
                    ? t('too_many_requests')
                    : t('generic_something_went_wrong')}
                </div>
              </>
            )}
          </>
        }
        action={
          <OLButton
            variant="link"
            onClick={handleRequestReconfirmation}
            className="btn-inline-link"
            disabled={isLoading}
            isLoading={isLoading}
          >
            {t('resend_confirmation_email')}
          </OLButton>
        }
      />
    )
  }

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
            {t('learn_more')}
          </a>
          {isError && (
            <>
              <br />
              <div>
                {rateLimited
                  ? t('too_many_requests')
                  : t('generic_something_went_wrong')}
              </div>
            </>
          )}
        </>
      }
      action={
        <OLButton
          variant="secondary"
          isLoading={isLoading || isPending}
          disabled={isLoading || isPending}
          onClick={handleRequestReconfirmation}
        >
          {t('confirm_affiliation')}
        </OLButton>
      }
    />
  )
}

export default ReconfirmAffiliation
