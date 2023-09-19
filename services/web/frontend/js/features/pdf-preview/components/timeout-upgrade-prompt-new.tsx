import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback } from 'react'
import PdfLogEntry from './pdf-log-entry'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import { Button } from 'react-bootstrap'
import * as eventTracking from '../../../infrastructure/event-tracking'

function TimeoutUpgradePromptNew() {
  const {
    startCompile,
    lastCompileOptions,
    setAnimateCompileDropdownArrow,
    showNewCompileTimeoutUI,
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

  if (!window.ExposedSettings.enableSubscriptions) {
    return null
  }

  const compileTimeChanging = showNewCompileTimeoutUI === 'changing'

  return (
    <>
      <CompileTimeout
        compileTimeChanging={compileTimeChanging}
        isProjectOwner={isProjectOwner}
      />
      <PreventTimeoutHelpMessage
        compileTimeChanging={compileTimeChanging}
        handleEnableStopOnFirstErrorClick={handleEnableStopOnFirstErrorClick}
        lastCompileOptions={lastCompileOptions}
      />
    </>
  )
}

type CompileTimeoutProps = {
  compileTimeChanging?: boolean
  isProjectOwner: boolean
}

const CompileTimeout = memo(function CompileTimeout({
  compileTimeChanging,
  isProjectOwner,
}: CompileTimeoutProps) {
  const { t } = useTranslation()
  return (
    <PdfLogEntry
      headerTitle={t('your_compile_timed_out')}
      formattedContent={
        <>
          <p>
            {isProjectOwner
              ? t('your_project_exceeded_compile_timeout_limit_on_free_plan')
              : t('this_project_exceeded_compile_timeout_limit_on_free_plan')}
          </p>
          {isProjectOwner ? (
            <p>
              {compileTimeChanging ? (
                <>
                  <strong>{t('upgrade_for_plenty_more_compile_time')}</strong>{' '}
                  {t(
                    'plus_additional_collaborators_document_history_track_changes_and_more'
                  )}
                </>
              ) : (
                <>
                  <strong>
                    <Trans i18nKey="upgrade_for_12x_more_compile_time" />
                  </strong>{' '}
                  <Trans i18nKey="plus_additional_collaborators_document_history_track_changes_and_more" />
                </>
              )}
            </p>
          ) : (
            <Trans
              i18nKey="tell_the_project_owner_and_ask_them_to_upgrade"
              components={[
                // eslint-disable-next-line react/jsx-key
                <strong />,
              ]}
            />
          )}

          {isProjectOwner && (
            <p className="text-center">
              <StartFreeTrialButton
                variant={compileTimeChanging ? 'new-changing' : 'new-20s'}
                source="compile-timeout"
                buttonProps={{
                  bsStyle: 'success',
                  className: 'row-spaced-small',
                  block: true,
                }}
              >
                {t('start_a_free_trial')}
              </StartFreeTrialButton>
            </p>
          )}
        </>
      }
      entryAriaLabel={t('your_compile_timed_out')}
      level="error"
    />
  )
})

type PreventTimeoutHelpMessageProps = {
  compileTimeChanging?: boolean
  lastCompileOptions: any
  handleEnableStopOnFirstErrorClick: () => void
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  compileTimeChanging,
  lastCompileOptions,
  handleEnableStopOnFirstErrorClick,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()

  function sendInfoClickEvent() {
    eventTracking.sendMB('paywall-info-click', {
      'paywall-type': 'compile-timeout',
      content: 'blog',
    })
  }

  return (
    <PdfLogEntry
      headerTitle={t('other_ways_to_prevent_compile_timeouts')}
      formattedContent={
        <>
          <p>
            {t('you_may_be_able_to_prevent_a_compile_timeout')}
            {compileTimeChanging && (
              <>
                {' '}
                <Trans
                  i18nKey="but_note_that_free_compile_timeout_limit_will_be_reduced_on_x_date"
                  components={[
                    // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                    <a
                      aria-label={t(
                        'read_more_about_free_compile_timeouts_servers'
                      )}
                      href="/blog/changes-to-free-compile-timeouts-and-servers"
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={sendInfoClickEvent}
                    />,
                  ]}
                  values={{ date: 'October 6 2023' }}
                />
              </>
            )}
          </p>
          <p>{t('common_causes_of_compile_timeouts_are')}:</p>
          <ul>
            <li>
              <Trans
                i18nKey="large_or_high-resolution_images_taking_too_long"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a
                    href="/learn/how-to/Optimising_very_large_image_files"
                    rel="noopener noreferrer"
                    target="_blank"
                  />,
                ]}
              />
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
                    i18nKey="enable_stop_on_first_error_under_recompile_dropdown_menu"
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <Button
                        bsSize="xs"
                        bsStyle="info-ghost-inline"
                        onClick={handleEnableStopOnFirstErrorClick}
                      />,
                      // eslint-disable-next-line react/jsx-key
                      <strong />,
                    ]}
                  />{' '}
                </>
              )}
            </li>
          </ul>
          <p>
            <Trans
              i18nKey="learn_more_about_other_causes_of_compile_timeouts"
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
      entryAriaLabel={t('other_ways_to_prevent_compile_timeouts')}
      level="raw"
    />
  )
})

export default memo(TimeoutUpgradePromptNew)
