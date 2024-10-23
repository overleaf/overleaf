import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback } from 'react'
import PdfLogEntry from './pdf-log-entry'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import OLButton from '@/features/ui/components/ol/ol-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import getMeta from '@/utils/meta'

function TimeoutUpgradePromptNew() {
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
    <>
      <CompileTimeout isProjectOwner={isProjectOwner} />
      {getMeta('ol-ExposedSettings').enableSubscriptions && (
        <PreventTimeoutHelpMessage
          handleEnableStopOnFirstErrorClick={handleEnableStopOnFirstErrorClick}
          lastCompileOptions={lastCompileOptions}
          isProjectOwner={isProjectOwner}
        />
      )}
    </>
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

  return (
    <PdfLogEntry
      headerTitle={t('your_compile_timed_out')}
      formattedContent={
        getMeta('ol-ExposedSettings').enableSubscriptions && (
          <>
            <p>
              {isProjectOwner
                ? t('your_project_exceeded_compile_timeout_limit_on_free_plan')
                : t('this_project_exceeded_compile_timeout_limit_on_free_plan')}
            </p>
            {isProjectOwner ? (
              <p>
                <strong>{t('upgrade_for_12x_more_compile_time')}</strong>{' '}
                {t(
                  'plus_additional_collaborators_document_history_track_changes_and_more'
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
                  source="compile-timeout"
                  buttonProps={{ variant: 'primary', className: 'w-100' }}
                >
                  {hasNewPaywallCta
                    ? t('get_more_compile_time')
                    : t('start_a_free_trial')}
                </StartFreeTrialButton>
              </p>
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

  function sendInfoClickEvent() {
    eventTracking.sendMB('paywall-info-click', {
      'paywall-type': 'compile-timeout',
      content: 'blog',
    })
  }

  const compileTimeoutChangesBlogLink = (
    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
    <a
      aria-label={t('read_more_about_free_compile_timeouts_servers')}
      href="/blog/changes-to-free-compile-timeouts-and-servers"
      rel="noopener noreferrer"
      target="_blank"
      onClick={sendInfoClickEvent}
    />
  )

  return (
    <PdfLogEntry
      headerTitle={t('reasons_for_compile_timeouts')}
      formattedContent={
        <>
          <p>{t('common_causes_of_compile_timeouts_include')}:</p>
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
                      <OLButton
                        variant="link"
                        className="btn-inline-link fw-bold"
                        size="sm"
                        onClick={handleEnableStopOnFirstErrorClick}
                        bs3Props={{ bsSize: 'xsmall' }}
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
          <p>
            <em>
              <>
                {isProjectOwner ? (
                  <Trans
                    i18nKey="weve_recently_reduced_the_compile_timeout_limit_which_may_have_affected_your_project"
                    components={[compileTimeoutChangesBlogLink]}
                  />
                ) : (
                  <Trans
                    i18nKey="weve_recently_reduced_the_compile_timeout_limit_which_may_have_affected_this_project"
                    components={[compileTimeoutChangesBlogLink]}
                  />
                )}
              </>
            </em>
          </p>
        </>
      }
      // @ts-ignore
      entryAriaLabel={t('reasons_for_compile_timeouts')}
      level="raw"
    />
  )
})

export default memo(TimeoutUpgradePromptNew)
