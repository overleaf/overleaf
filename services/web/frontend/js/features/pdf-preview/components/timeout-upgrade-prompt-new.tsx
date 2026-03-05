import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback, useMemo, useState } from 'react'
import PdfLogEntry from './pdf-log-entry'
import * as eventTracking from '../../../infrastructure/event-tracking'
import getMeta from '@/utils/meta'
import { populateEditorRedesignSegmentation } from '@/shared/hooks/use-editor-analytics'
import CompileTimeoutPaywallModal from '@/features/pdf-preview/components/compile-timeout-paywall-modal'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function TimeoutUpgradePromptNew() {
  const { isProjectOwner } = useDetachCompileContext()
  const isCompileTimeoutTargetPlansEnabled = isSplitTestEnabled(
    'compile-timeout-target-plans'
  )

  const [showCompileTimeoutPaywall, setShowCompileTimeoutPaywall] =
    useState(false)

  const { compileTimeout } = getMeta('ol-compileSettings')

  const sharedSegmentation = useMemo(
    () =>
      populateEditorRedesignSegmentation({
        'is-owner': isProjectOwner,
        compileTime: compileTimeout,
        location: 'logs',
      }),
    [isProjectOwner, compileTimeout]
  )

  return (
    <>
      <CompileTimeout
        isProjectOwner={isProjectOwner}
        segmentation={sharedSegmentation}
        onShowPaywallModal={() => setShowCompileTimeoutPaywall(true)}
        isCompileTimeoutTargetPlansEnabled={isCompileTimeoutTargetPlansEnabled}
      />
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
  const plans2026 = useFeatureFlag('plans-2026-phase-1')
  const extraSearchParams = useMemo(() => {
    return {
      itm_content: 'new-editor',
    }
  }, [])

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
                {plans2026
                  ? t('plus_additional_collaborators_and_more')
                  : t(
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

export default memo(TimeoutUpgradePromptNew)
