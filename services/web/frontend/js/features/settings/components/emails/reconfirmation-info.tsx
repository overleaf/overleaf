import { useState, useEffect, useLayoutEffect } from 'react'
import { UserEmailData } from '../../../../../../types/user-email'
import getMeta from '../../../../utils/meta'
import ReconfirmationInfoSuccess from './reconfirmation-info/reconfirmation-info-success'
import ReconfirmationInfoPromptText from './reconfirmation-info/reconfirmation-info-prompt-text'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import ColWrapper from '@/features/ui/components/bootstrap-5/wrappers/col-wrapper'
import NotificationWrapper from '@/features/ui/components/bootstrap-5/wrappers/notification-wrapper'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'
import Icon from '@/shared/components/icon'
import { useUserEmailsContext } from '@/features/settings/context/user-email-context'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { ssoAvailableForInstitution } from '@/features/settings/utils/sso'
import { Trans, useTranslation } from 'react-i18next'
import useAsync from '@/shared/hooks/use-async'
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import { useLocation } from '@/shared/hooks/use-location'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import classnames from 'classnames'

type ReconfirmationInfoProps = {
  userEmailData: UserEmailData
}

function ReconfirmationInfo({ userEmailData }: ReconfirmationInfoProps) {
  const reconfirmationRemoveEmail = getMeta(
    'ol-reconfirmationRemoveEmail'
  ) as string
  const reconfirmedViaSAML = getMeta('ol-reconfirmedViaSAML') as string

  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
  const { error, isLoading, isError, isSuccess, runAsync } = useAsync()
  const { state, setLoading: setUserEmailsContextLoading } =
    useUserEmailsContext()
  const [hasSent, setHasSent] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const location = useLocation()
  const ssoAvailable = Boolean(
    ssoAvailableForInstitution(userEmailData.affiliation?.institution ?? null)
  )

  const handleRequestReconfirmation = () => {
    if (userEmailData.affiliation?.institution && ssoAvailable) {
      setIsPending(true)
      location.assign(
        `${samlInitPath}?university_id=${userEmailData.affiliation.institution.id}&reconfirm=/user/settings`
      )
    } else {
      runAsync(
        postJSON('/user/emails/send-reconfirmation', {
          body: {
            email: userEmailData.email,
          },
        })
      ).catch(debugConsole.error)
    }
  }

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  useLayoutEffect(() => {
    if (isSuccess) {
      setHasSent(true)
    }
  }, [isSuccess])

  const rateLimited =
    isError && error instanceof FetchError && error.response?.status === 429

  if (!userEmailData.affiliation) {
    return null
  }

  if (
    userEmailData.samlProviderId &&
    userEmailData.samlProviderId === reconfirmedViaSAML
  ) {
    return (
      <RowWrapper>
        <ColWrapper md={12}>
          <NotificationWrapper
            type="info"
            content={
              <ReconfirmationInfoSuccess
                institution={userEmailData.affiliation.institution}
              />
            }
            bs3Props={{ className: 'settings-reconfirm-info small' }}
          />
        </ColWrapper>
      </RowWrapper>
    )
  }

  if (userEmailData.affiliation.inReconfirmNotificationPeriod) {
    return (
      <RowWrapper>
        <ColWrapper md={12}>
          {isBootstrap5 ? (
            <NotificationWrapper
              type="info"
              content={
                <>
                  {hasSent ? (
                    <Trans
                      i18nKey="please_check_your_inbox_to_confirm"
                      values={{
                        institutionName:
                          userEmailData.affiliation.institution.name,
                      }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                      components={
                        /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                        [<strong />]
                      }
                    />
                  ) : (
                    <ReconfirmationInfoPromptText
                      institutionName={
                        userEmailData.affiliation.institution.name
                      }
                      primary={userEmailData.default}
                    />
                  )}
                  <br />
                  {isError && (
                    <div className="text-danger">
                      {rateLimited
                        ? t('too_many_requests')
                        : t('generic_something_went_wrong')}
                    </div>
                  )}
                </>
              }
              action={
                hasSent ? (
                  <>
                    {isLoading ? (
                      <>
                        <Icon type="refresh" spin fw /> {t('sending')}...
                      </>
                    ) : (
                      <ButtonWrapper
                        variant="link"
                        disabled={state.isLoading}
                        onClick={handleRequestReconfirmation}
                        bs3Props={{
                          className: 'btn-inline-link',
                          bsStyle: null,
                        }}
                      >
                        {t('resend_confirmation_email')}
                      </ButtonWrapper>
                    )}
                  </>
                ) : (
                  <ButtonWrapper
                    variant="secondary"
                    disabled={isPending}
                    isLoading={isLoading}
                    onClick={handleRequestReconfirmation}
                    bs3Props={{ bsStyle: 'info' }}
                  >
                    {isLoading ? (
                      <>
                        <Icon type="refresh" spin fw /> {t('sending')}...
                      </>
                    ) : (
                      t('confirm_affiliation')
                    )}
                  </ButtonWrapper>
                )
              }
            />
          ) : (
            <div
              className={classnames('settings-reconfirm-info', 'small', {
                'alert alert-info':
                  reconfirmationRemoveEmail === userEmailData.email,
              })}
            >
              {hasSent ? (
                <div>
                  <Trans
                    i18nKey="please_check_your_inbox_to_confirm"
                    values={{
                      institutionName:
                        userEmailData.affiliation.institution.name,
                    }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
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
                    <ButtonWrapper
                      variant="link"
                      disabled={state.isLoading}
                      onClick={handleRequestReconfirmation}
                      bs3Props={{ className: 'btn-inline-link', bsStyle: null }}
                    >
                      {t('resend_confirmation_email')}
                    </ButtonWrapper>
                  )}
                  <br />
                  {isError && (
                    <div className="text-danger">
                      {rateLimited
                        ? t('too_many_requests')
                        : t('generic_something_went_wrong')}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <ReconfirmationInfoPromptText
                      institutionName={
                        userEmailData.affiliation.institution.name
                      }
                      primary={userEmailData.default}
                      icon={
                        <Icon type="warning" className="me-1 icon-warning" />
                      }
                    />
                  </div>
                  <div className="setting-reconfirm-info-right">
                    <ButtonWrapper
                      variant="secondary"
                      disabled={state.isLoading || isPending}
                      onClick={handleRequestReconfirmation}
                      bs3Props={{ bsStyle: 'info' }}
                    >
                      {isLoading ? (
                        <>
                          <Icon type="refresh" spin fw /> {t('sending')}...
                        </>
                      ) : (
                        t('confirm_affiliation')
                      )}
                    </ButtonWrapper>
                    <br />
                    {isError && (
                      <div className="text-danger">
                        {rateLimited
                          ? t('too_many_requests')
                          : t('generic_something_went_wrong')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </ColWrapper>
      </RowWrapper>
    )
  }

  return null
}

export default ReconfirmationInfo
