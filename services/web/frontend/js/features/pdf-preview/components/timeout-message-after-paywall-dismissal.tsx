import getMeta from '@/utils/meta'
import { Trans, useTranslation } from 'react-i18next'
import { memo, useCallback, useEffect } from 'react'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useStopOnFirstError } from '@/shared/hooks/use-stop-on-first-error'
import * as eventTracking from '@/infrastructure/event-tracking'
import PdfLogEntry from './pdf-log-entry'

function TimeoutMessageAfterPaywallDismissal() {
  const {
    startCompile,
    lastCompileOptions,
    setAnimateCompileDropdownArrow,
    isProjectOwner,
  } = useDetachCompileContext()

  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'timeout-new',
  })

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  return (
    <div className="website-redesign timeout-upgrade-paywall-prompt">
      <CompileTimeout isProjectOwner={isProjectOwner} />
      {getMeta('ol-ExposedSettings').enableSubscriptions && (
        <PreventTimeoutHelpMessage
          handleEnableStopOnFirstErrorClick={handleEnableStopOnFirstErrorClick}
          lastCompileOptions={lastCompileOptions}
          isProjectOwner={isProjectOwner}
        />
      )}
    </div>
  )
}

type CompileTimeoutProps = {
  isProjectOwner: boolean
}

const CompileTimeout = memo(function CompileTimeout({
  isProjectOwner,
}: CompileTimeoutProps) {
  const { t } = useTranslation()

  const hasNewPaywallCta = useFeatureFlag('paywall-cta')

  useEffect(() => {
    eventTracking.sendMB('paywall-prompt', {
      'paywall-type': 'compile-timeout',
      'paywall-version': 'secondary',
    })
  }, [])

  function onPaywallClick() {
    eventTracking.sendMB('paywall-click', {
      'paywall-type': 'compile-timeout',
      'paywall-version': 'secondary',
    })
  }

  return (
    <PdfLogEntry
      headerTitle={t('project_failed_to_compile')}
      headerIcon={
        <MaterialIcon
          type="error"
          className="log-entry-header-title"
          size="2x"
          unfilled
        />
      }
      formattedContent={
        getMeta('ol-ExposedSettings').enableSubscriptions && (
          <>
            <p className="compile-timeout-message">
              {isProjectOwner ? (
                <div>
                  <p>{t('your_project_need_more_time_to_compile')}</p>
                  <p>{t('upgrade_to_unlock_more_time')}</p>
                </div>
              ) : (
                <div>
                  <p>{t('this_project_need_more_time_to_compile')}</p>
                  <p>{t('upgrade_to_unlock_more_time')}</p>
                </div>
              )}
            </p>

            {isProjectOwner === false && (
              <Trans
                i18nKey="tell_the_project_owner_and_ask_them_to_upgrade"
                components={[
                  // eslint-disable-next-line react/jsx-key
                  <strong />,
                ]}
              />
            )}

            {isProjectOwner && (
              <div className="log-entry-cta-container">
                <StartFreeTrialButton
                  source="compile-timeout"
                  buttonProps={{ variant: 'secondary' }}
                  handleClick={onPaywallClick}
                >
                  {hasNewPaywallCta
                    ? t('get_more_compile_time')
                    : t('try_for_free')}
                </StartFreeTrialButton>
              </div>
            )}
          </>
        )
      }
      // @ts-ignore
      entryAriaLabel={t('your_compile_timed_out')}
      level="error"
    />
  )
})

type PreventTimeoutHelpMessageProps = {
  lastCompileOptions: any
  handleEnableStopOnFirstErrorClick: () => void
  isProjectOwner: boolean
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  lastCompileOptions,
  handleEnableStopOnFirstErrorClick,
  isProjectOwner,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()

  return (
    <PdfLogEntry
      headerTitle={t('other_causes_of_compile_timeouts')}
      formattedContent={
        <>
          <ul>
            <li>
              {t('large_or_high_resolution_images_taking_too_long_to_process')}
            </li>
            <li>
              <Trans
                i18nKey="a_fatal_compile_error_that_completely_blocks_compilation"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a
                    href="/learn/how-to/Fixing_and_preventing_compile_timeouts#Step_3:_Assess_your_project_for_time-consuming_tasks_and_fatal_errors"
                    rel="noopener noreferrer"
                    target="_blank"
                  />,
                ]}
              />
              {!lastCompileOptions.stopOnFirstError && (
                <>
                  {' '}
                  <Trans
                    i18nKey="enable_stop_on_first_error_under_recompile_dropdown_menu_v2"
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <strong className="log-bold-text" />,
                      // eslint-disable-next-line react/jsx-key
                      <strong className="log-bold-text" />,
                    ]}
                  />{' '}
                </>
              )}
            </li>
          </ul>
          <p className="mb-0">
            <Trans
              i18nKey="learn_more_about_compile_timeouts"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a
                  href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
                  rel="noopener noreferrer"
                  target="_blank"
                />,
              ]}
            />
          </p>
        </>
      }
      // @ts-ignore
      entryAriaLabel={t('reasons_for_compile_timeouts')}
      level="raw"
    />
  )
})

export default memo(TimeoutMessageAfterPaywallDismissal)
