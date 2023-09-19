import { memo, useCallback, useEffect, useState, useMemo } from 'react'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import Notification from '../../../shared/components/notification'
import { Trans, useTranslation } from 'react-i18next'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'

function CompileTimeoutMessages() {
  const {
    showNewCompileTimeoutUI,
    isProjectOwner,
    deliveryLatencies,
    compiling,
    showLogs,
    error,
  } = useDetachCompileContext()

  const { t } = useTranslation()

  const [showWarning, setShowWarning] = useState(false)
  const [showChangingSoon, setShowChangingSoon] = useState(false)
  const [dismissedUntilWarning, setDismissedUntilWarning] = usePersistedState<
    Date | undefined
  >(`has-dismissed-10s-compile-time-warning-until`)

  const segmentation = useMemo(() => {
    return {
      newCompileTimeout: showNewCompileTimeoutUI,
      isProjectOwner,
    }
  }, [showNewCompileTimeoutUI, isProjectOwner])

  const handleNewCompile = useCallback(
    compileTime => {
      setShowWarning(false)
      setShowChangingSoon(false)
      if (compileTime > 20000) {
        if (showNewCompileTimeoutUI === 'changing') {
          setShowChangingSoon(true)
          eventTracking.sendMB('compile-time-warning-displayed', {
            time: 20,
            ...segmentation,
          })
        }
      } else if (compileTime > 10000) {
        setShowChangingSoon(false)
        if (
          (isProjectOwner && showNewCompileTimeoutUI === 'active') ||
          showNewCompileTimeoutUI === 'changing'
        ) {
          if (
            !dismissedUntilWarning ||
            new Date(dismissedUntilWarning) < new Date()
          ) {
            setShowWarning(true)
            eventTracking.sendMB('compile-time-warning-displayed', {
              time: 10,
              ...segmentation,
            })
          }
        }
      }
    },
    [
      isProjectOwner,
      showNewCompileTimeoutUI,
      dismissedUntilWarning,
      segmentation,
    ]
  )

  const handleDismissWarning = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      time: 10,
      ...segmentation,
    })
    setShowWarning(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntilWarning(until)
  }, [setDismissedUntilWarning, segmentation])

  const handleDismissChangingSoon = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      time: 20,
      ...segmentation,
    })
  }, [segmentation])

  useEffect(() => {
    if (compiling || error || showLogs) return
    handleNewCompile(deliveryLatencies.compileTimeServerE2E)
  }, [compiling, error, showLogs, deliveryLatencies, handleNewCompile])

  if (!window.ExposedSettings.enableSubscriptions) {
    return null
  }

  if (compiling || error || showLogs) {
    return null
  }

  if (!showWarning && !showChangingSoon) {
    return null
  }

  function sendInfoClickEvent() {
    eventTracking.sendMB('paywall-info-click', {
      'paywall-type': 'compile-time-warning',
      content: 'blog',
    })
  }

  const compileTimeoutBlogLinks = [
    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
    <a
      aria-label={t('read_more_about_free_compile_timeouts_servers')}
      href="/blog/changes-to-free-compile-timeouts-and-servers"
      key="compileTimeoutBlogLink1"
      rel="noopener noreferrer"
      target="_blank"
      onClick={sendInfoClickEvent}
    />,
    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
    <a
      aria-label={t('read_more_about_fix_prevent_timeout')}
      href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
      key="compileTimeoutBlogLink2"
      target="_blank"
      rel="noopener noreferrer"
    />,
  ]

  // if showWarning is true then the 10s warning is shown
  // and if showChangingSoon is true then the 20s-60s should show

  return (
    <div>
      {showWarning && isProjectOwner && (
        <Notification
          action={
            <StartFreeTrialButton
              variant="new-10s"
              source="compile-time-warning"
              buttonProps={{
                className: 'btn-secondary-compile-timeout-override',
              }}
            >
              {t('start_free_trial_without_exclamation')}
            </StartFreeTrialButton>
          }
          ariaLive="polite"
          content={
            <div>
              <div>
                <span>
                  <Trans i18nKey="your_project_near_compile_timeout_limit" />
                </span>
              </div>
              {showNewCompileTimeoutUI === 'active' ? (
                <>
                  <strong>
                    <Trans i18nKey="upgrade_for_12x_more_compile_time" />
                  </strong>
                  {'. '}
                </>
              ) : (
                <strong>
                  <Trans i18nKey="upgrade_for_plenty_more_compile_time" />
                </strong>
              )}
            </div>
          }
          type="warning"
          title={t('took_a_while')}
          isActionBelowContent
          isDismissible
          onDismiss={handleDismissWarning}
        />
      )}
      {showChangingSoon &&
        (isProjectOwner ? (
          <Notification
            action={
              <StartFreeTrialButton
                variant="new-changing"
                source="compile-time-warning"
                buttonProps={{
                  className: 'btn-secondary-compile-timeout-override',
                }}
              >
                {t('start_free_trial_without_exclamation')}
              </StartFreeTrialButton>
            }
            ariaLive="polite"
            content={
              <div>
                <p>
                  <Trans
                    i18nKey="compile_timeout_will_be_reduced_project_exceeds_limit_speed_up_compile"
                    components={compileTimeoutBlogLinks}
                    values={{ date: 'October 6 2023' }}
                  />{' '}
                  <Trans i18nKey="and_you_can_upgrade_for_plenty_more_compile_time" />
                </p>
              </div>
            }
            title={t('your_project_compiled_but_soon_might_not')}
            type="warning"
            isActionBelowContent
            isDismissible
            onDismiss={handleDismissChangingSoon}
          />
        ) : (
          <Notification
            ariaLive="polite"
            content={
              <div>
                <p>
                  <Trans
                    i18nKey="compile_timeout_will_be_reduced_project_exceeds_limit_speed_up_compile"
                    components={compileTimeoutBlogLinks}
                    values={{ date: 'October 6 2023' }}
                  />
                </p>
                <p className="row-spaced">
                  <Trans i18nKey="tell_the_project_owner_to_upgrade_plan_for_more_compile_time" />
                </p>
              </div>
            }
            title={t('this_project_compiled_but_soon_might_not')}
            type="warning"
            isDismissible
            onDismiss={handleDismissChangingSoon}
          />
        ))}
    </div>
  )
}

export default memo(CompileTimeoutMessages)
