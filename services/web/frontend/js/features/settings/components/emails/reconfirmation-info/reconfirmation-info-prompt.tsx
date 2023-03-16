import { useState, useEffect, useLayoutEffect } from 'react'
import useAsync from '../../../../../shared/hooks/use-async'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { Trans, useTranslation } from 'react-i18next'
import { Institution } from '../../../../../../../types/institution'
import { Button } from 'react-bootstrap'
import { useUserEmailsContext } from '../../../context/user-email-context'
import getMeta from '../../../../../utils/meta'
import { ExposedSettings } from '../../../../../../../types/exposed-settings'
import { ssoAvailableForInstitution } from '../../../utils/sso'
import Icon from '../../../../../shared/components/icon'
import { useLocation } from '../../../../../shared/hooks/use-location'

type ReconfirmationInfoPromptProps = {
  email: string
  primary: boolean
  institution: Institution
}

function ReconfirmationInfoPrompt({
  email,
  primary,
  institution,
}: ReconfirmationInfoPromptProps) {
  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
  const { isLoading, isError, isSuccess, runAsync } = useAsync()
  const { state, setLoading: setUserEmailsContextLoading } =
    useUserEmailsContext()
  const [isPending, setIsPending] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const ssoAvailable = Boolean(ssoAvailableForInstitution(institution))
  const location = useLocation()

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  useLayoutEffect(() => {
    if (isSuccess) {
      setHasSent(true)
    }
  }, [isSuccess])

  const handleRequestReconfirmation = () => {
    if (ssoAvailable) {
      setIsPending(true)
      location.assign(
        `${samlInitPath}?university_id=${institution.id}&reconfirm=/user/settings`
      )
    } else {
      runAsync(
        postJSON('/user/emails/send-reconfirmation', {
          body: {
            email,
          },
        })
      ).catch(console.error)
    }
  }

  if (hasSent) {
    return (
      <div>
        <Trans
          i18nKey="please_check_your_inbox_to_confirm"
          values={{
            institutionName: institution.name,
          }}
          components={
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            [<strong />]
          }
        />{' '}
        {isLoading ? (
          <>
            <Icon type="refresh" spin fw /> {t('sending')}...
          </>
        ) : (
          <Button
            className="btn-inline-link"
            disabled={state.isLoading}
            onClick={handleRequestReconfirmation}
          >
            {t('resend_confirmation_email')}
          </Button>
        )}
        <br />
        {isError && (
          <div className="text-danger">{t('generic_something_went_wrong')}</div>
        )}
      </div>
    )
  }

  return (
    <>
      <div>
        <ReconfirmationInfoPromptText
          institutionName={institution.name}
          primary={primary}
        />
      </div>
      <div className="setting-reconfirm-info-right">
        <Button
          bsStyle="info"
          disabled={state.isLoading || isPending}
          onClick={handleRequestReconfirmation}
        >
          {isLoading ? (
            <>
              <Icon type="refresh" spin fw /> {t('sending')}...
            </>
          ) : (
            t('confirm_affiliation')
          )}
        </Button>
        <br />
        {isError && (
          <div className="text-danger">{t('generic_something_went_wrong')}</div>
        )}
      </div>
    </>
  )
}

type ReconfirmationInfoPromptTextProps = {
  primary: boolean
  institutionName: Institution['name']
}

function ReconfirmationInfoPromptText({
  primary,
  institutionName,
}: ReconfirmationInfoPromptTextProps) {
  const { t } = useTranslation()

  return (
    <div>
      <Icon type="warning" className="me-1 icon-warning" />
      <Trans
        i18nKey="are_you_still_at"
        values={{
          institutionName,
        }}
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
      <a href="/learn/how-to/Institutional_Email_Reconfirmation">
        {t('learn_more')}
      </a>
      <br />
      {primary ? <i>{t('need_to_add_new_primary_before_remove')}</i> : null}
    </div>
  )
}

export default ReconfirmationInfoPrompt
