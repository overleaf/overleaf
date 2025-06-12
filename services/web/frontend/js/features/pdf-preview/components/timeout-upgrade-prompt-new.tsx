import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback, useMemo } from 'react'
import PdfLogEntry from './pdf-log-entry'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import OLButton from '@/features/ui/components/ol/ol-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
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

  const { reducedTimeoutWarning, compileTimeout } =
    getMeta('ol-compileSettings')

  const sharedSegmentation = useMemo(
    () => ({
      '10s-timeout-warning': reducedTimeoutWarning,
      'is-owner': isProjectOwner,
      compileTime: compileTimeout,
    }),
    [isProjectOwner, reducedTimeoutWarning, compileTimeout]
  )

  return (
    <>
      <CompileTimeout
        isProjectOwner={isProjectOwner}
        segmentation={sharedSegmentation}
      />
      {getMeta('ol-ExposedSettings').enableSubscriptions && (
        <PreventTimeoutHelpMessage
          handleEnableStopOnFirstErrorClick={handleEnableStopOnFirstErrorClick}
          lastCompileOptions={lastCompileOptions}
          segmentation={sharedSegmentation}
        />
      )}
    </>
  )
}

type CompileTimeoutProps = {
  isProjectOwner: boolean
  segmentation: eventTracking.Segmentation
}

const CompileTimeout = memo(function CompileTimeout({
  isProjectOwner,
  segmentation,
}: CompileTimeoutProps) {
  const { t } = useTranslation()

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
                <strong>{t('upgrade_for_more_compile_time')}</strong>{' '}
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
                  segmentation={segmentation}
                >
                  {t('start_a_free_trial')}
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
  segmentation: eventTracking.Segmentation
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  lastCompileOptions,
  handleEnableStopOnFirstErrorClick,
  segmentation,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()

  function sendInfoClickEvent() {
    eventTracking.sendMB('paywall-info-click', {
      ...segmentation,
      'paywall-type': 'compile-timeout',
      content: 'blog',
    })
  }

  const compileTimeoutChangesBlogLink = (
    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
    <a
      aria-label={t('read_more_about_free_compile_timeouts_servers')}
      href="/blog/changes-to-free-compile-timeout"
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
          {segmentation?.['10s-timeout-warning'] === 'enabled' && (
            <p>
              <em>
                <Trans
                  i18nKey="were_reducing_compile_timeout"
                  components={[compileTimeoutChangesBlogLink]}
                />
              </em>
            </p>
          )}
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
      // @ts-ignore
      entryAriaLabel={t('reasons_for_compile_timeouts')}
      level="raw"
    />
  )
})

export default memo(TimeoutUpgradePromptNew)
