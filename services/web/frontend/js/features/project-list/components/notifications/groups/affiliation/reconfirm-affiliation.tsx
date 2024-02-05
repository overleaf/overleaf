import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import getMeta from '../../../../../../utils/meta'
import useAsync from '../../../../../../shared/hooks/use-async'
import {
  FetchError,
  postJSON,
} from '../../../../../../infrastructure/fetch-json'
import { UserEmailData } from '../../../../../../../../types/user-email'
import { ExposedSettings } from '../../../../../../../../types/exposed-settings'
import { Institution } from '../../../../../../../../types/institution'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'

type ReconfirmAffiliationProps = {
  email: UserEmailData['email']
  institution: Institution
}

function ReconfirmAffiliation({
  email,
  institution,
}: ReconfirmAffiliationProps) {
  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
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
      <div className="w-100">
        <Trans
          i18nKey="please_check_your_inbox_to_confirm"
          components={[<b />]} // eslint-disable-line react/jsx-key
          values={{ institutionName: institution.name }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
        &nbsp;
        {isLoading ? (
          <>
            <Icon type="refresh" spin fw /> {t('sending')}&hellip;
          </>
        ) : (
          <Button
            className="btn-inline-link"
            disabled={isLoading}
            onClick={handleRequestReconfirmation}
          >
            {t('resend_confirmation_email')}
          </Button>
        )}
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
      </div>
    )
  }

  return (
    <div className="w-100">
      {!newNotificationStyle && <Icon type="warning" />}
      <Button
        bsStyle="info"
        bsSize="sm"
        className="btn-reconfirm"
        onClick={handleRequestReconfirmation}
        disabled={isLoading || isPending}
      >
        {isLoading ? (
          <>
            <Icon type="refresh" spin fw /> {t('sending')}&hellip;
          </>
        ) : (
          t('confirm_affiliation')
        )}
      </Button>
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
    </div>
  )
}

export default ReconfirmAffiliation
