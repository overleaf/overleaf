import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback, useMemo, useState } from 'react'
import PdfLogEntry from './pdf-log-entry'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import OLButton from '@/shared/components/ol/ol-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
import getMeta from '@/utils/meta'
import { populateEditorRedesignSegmentation } from '@/shared/hooks/use-editor-analytics'
import CompileTimeoutPaywallModal from '@/features/pdf-preview/components/compile-timeout-paywall-modal'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

function TimeoutUpgradePromptNew() {
  const {
    startCompile,
    lastCompileOptions,
    setAnimateCompileDropdownArrow,
    isProjectOwner,
  } = useDetachCompileContext()
  const newEditor = useIsNewEditorEnabled()
  const shouldHideCompileTimeoutInfo = isSplitTestEnabled(
    'compile-timeout-remove-info'
  )

  const isCompileTimeoutTargetPlansEnabled = isSplitTestEnabled(
    'compile-timeout-target-plans'
  )

  const [showCompileTimeoutPaywall, setShowCompileTimeoutPaywall] =
    useState(false)

  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'timeout-new',
  })

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  const { compileTimeout } = getMeta('ol-compileSettings')

  const sharedSegmentation = useMemo(
    () =>
      populateEditorRedesignSegmentation(
        {
          'is-owner': isProjectOwner,
          compileTime: compileTimeout,
          location: 'logs',
        },
        newEditor
      ),
    [isProjectOwner, compileTimeout, newEditor]
  )

  return (
    <>
      <CompileTimeout
        isProjectOwner={isProjectOwner}
        segmentation={sharedSegmentation}
        onShowPaywallModal={() => setShowCompileTimeoutPaywall(true)}
        isCompileTimeoutTargetPlansEnabled={isCompileTimeoutTargetPlansEnabled}
      />
      {getMeta('ol-ExposedSettings').enableSubscriptions &&
        !shouldHideCompileTimeoutInfo && (
          <PreventTimeoutHelpMessage
            handleEnableStopOnFirstErrorClick={
              handleEnableStopOnFirstErrorClick
            }
            lastCompileOptions={lastCompileOptions}
          />
        )}
      <CompileTimeoutPaywallModal
        show={showCompileTimeoutPaywall}
        onHide={() => setShowCompileTimeoutPaywall(false)}
      />
    </>
  )
}

type CompileTimeoutProps = {
  isProjectOwner: boolean
  segmentation: eventTracking.Segmentation
  onShowPaywallModal: () => void
  isCompileTimeoutTargetPlansEnabled: boolean
}

const CompileTimeout = memo(function CompileTimeout({
  isProjectOwner,
  segmentation,
  onShowPaywallModal,
  isCompileTimeoutTargetPlansEnabled,
}: CompileTimeoutProps) {
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()
  const extraSearchParams = useMemo(() => {
    return {
      itm_content: newEditor ? 'new-editor' : 'old-editor',
    }
  }, [newEditor])

  const handleFreeTrialClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isCompileTimeoutTargetPlansEnabled) {
        event.preventDefault()
        event.stopPropagation()
        onShowPaywallModal()
      }
    },
    [isCompileTimeoutTargetPlansEnabled, onShowPaywallModal]
  )

  return (
    <PdfLogEntry
      autoExpand
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
                  extraSearchParams={extraSearchParams}
                  handleClick={handleFreeTrialClick}
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
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  lastCompileOptions,
  handleEnableStopOnFirstErrorClick,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()

  return (
    <PdfLogEntry
      autoExpand
      headerTitle={t('reasons_for_compile_timeouts')}
      formattedContent={
        <>
          <p>{t('common_causes_of_compile_timeouts_include')}:</p>
          <ul>
            <li>
              <Trans
                i18nKey="project_timed_out_optimize_images"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a
                    href="/learn/how-to/Optimising_very_large_image_files"
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={() => {
                      eventTracking.sendMB('paywall-info-click', {
                        'paywall-type': 'compile-timeout',
                        content: 'docs',
                        type: 'optimize',
                      })
                    }}
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
                    onClick={() => {
                      eventTracking.sendMB('paywall-info-click', {
                        'paywall-type': 'compile-timeout',
                        content: 'docs',
                        type: 'fatal-error',
                      })
                    }}
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
              i18nKey="project_timed_out_learn_more"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a
                  href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={() => {
                    eventTracking.sendMB('paywall-info-click', {
                      'paywall-type': 'compile-timeout',
                      content: 'docs',
                      type: 'learn-more',
                    })
                  }}
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
