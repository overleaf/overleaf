import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { Trans, useTranslation } from 'react-i18next'
import { useRailContext } from '../../contexts/rail-context'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useIsNewEditorEnabled } from '../../utils/new-editor-utils'
import { upgradePlan } from '@/main/account-upgrade'
import classNames from 'classnames'
import { useStopOnFirstError } from '@/shared/hooks/use-stop-on-first-error'
import { useCallback } from 'react'

// AvailableStates
// - rendering-error-expected
// - rendering-error
// - clsi-maintenance
// - clsi-unavailable
// - too-recently-compiled
// - terminated
// - rate-limited
// - compile-in-progress
// - autocompile-disabled
// - project-too-large
// - timedout
// - failure
// - clear-cache
// - pdf-viewer-loading-error
// - validation-problems
function PdfErrorState() {
  const { loadingError } = usePdfPreviewContext()
  // TODO ide-redesign-cleanup: rename showLogs to something else and check usages
  const { hasShortCompileTimeout, error, showLogs } = useCompileContext()
  const newEditor = useIsNewEditorEnabled()
  const { t } = useTranslation()

  if (!newEditor || (!loadingError && !showLogs)) {
    return null
  }

  switch (error) {
    case 'timedout': {
      if (hasShortCompileTimeout) {
        return <CompileTimeoutErrorState />
      } else {
        return <LongCompileTimeoutErrorState />
      }
    }
    case 'compile-in-progress':
      return (
        <ErrorState
          title={t('pdf_compile_in_progress_error')}
          description={t('pdf_compile_try_again')}
          iconType="warning"
        />
      )
    default:
      return <GeneralErrorState />
  }
}

const GeneralErrorState = () => {
  const { t } = useTranslation()
  const { openTab: openRailTab } = useRailContext()

  return (
    <ErrorState
      title={t('pdf_couldnt_compile')}
      description={t('we_are_unable_to_generate_the_pdf_at_this_time')}
      iconType="warning"
      actions={
        <OLButton
          variant="secondary"
          size="sm"
          onClick={() => {
            openRailTab('errors')
          }}
        >
          {t('check_logs')}
        </OLButton>
      }
      extraContent={
        <div className="pdf-error-state-info-box">
          <div className="pdf-error-state-info-box-title">
            <MaterialIcon type="info" unfilled />
            {t('why_might_this_happen')}
          </div>
          <div className="pdf-error-state-info-box-text">
            <ul className="pdf-error-state-info-box-list">
              <li>{t('there_is_an_unrecoverable_latex_error_check_logs')}</li>
              <li>{t('the_document_environment_contains_no_content')}</li>
              <li>{t('this_project_contains_a_file_called_output')}</li>
            </ul>
          </div>
        </div>
      }
    />
  )
}

const CompileTimeoutErrorState = () => {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('compile_limit_reached')}
      description={t('compile_limit_upgrade_prompt')}
      iconType="running_with_errors"
      actions={
        <OLButton
          variant="premium"
          size="sm"
          onClick={() => upgradePlan('compile-timeout')}
        >
          {t('upgrade')}
        </OLButton>
      }
    />
  )
}

const LongCompileTimeoutErrorState = () => {
  const { t } = useTranslation()

  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'timeout',
  })
  const { startCompile, lastCompileOptions, setAnimateCompileDropdownArrow } =
    useCompileContext()

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  return (
    <ErrorState
      title={t('compile_limit_reached')}
      description={t('project_timed_out_intro_short')}
      iconType="running_with_errors"
      extraContent={
        <div className="pdf-error-state-info-box">
          <div className="pdf-error-state-info-box-title">
            <MaterialIcon type="info" unfilled />
            {t('project_timed_out_common_causes')}
          </div>
          <div className="pdf-error-state-info-box-text">
            <ul className="pdf-error-state-info-box-list">
              <li>
                <Trans
                  i18nKey="project_timed_out_optimize_images"
                  components={[
                    // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                    <a href="https://www.overleaf.com/learn/how-to/Optimising_very_large_image_files" />,
                  ]}
                />
              </li>
              <li>
                <Trans
                  i18nKey="project_timed_out_fatal_error"
                  components={[
                    // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                    <a href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F#Fatal_compile_errors_blocking_the_compilation" />,
                  ]}
                />
                {!lastCompileOptions.stopOnFirstError && (
                  <>
                    {' '}
                    <Trans
                      i18nKey="project_timed_out_enable_stop_on_first_error"
                      components={[
                        // eslint-disable-next-line react/jsx-key
                        <OLButton
                          variant="primary"
                          size="sm"
                          onClick={handleEnableStopOnFirstErrorClick}
                        />,
                      ]}
                    />
                  </>
                )}
              </li>
            </ul>
            <p className="mb-0">
              <Trans
                i18nKey="project_timed_out_learn_more"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F" />,
                ]}
              />
            </p>
          </div>
        </div>
      }
    />
  )
}

const ErrorState = ({
  title,
  description,
  iconType,
  actions,
  iconClassName,
  extraContent,
}: {
  title: string
  description: string
  iconType: string
  actions?: React.ReactNode
  iconClassName?: string
  extraContent?: React.ReactNode
}) => {
  return (
    <div className="pdf-error-state">
      <div className="pdf-error-state-top-section">
        <div
          className={classNames(
            'pdf-error-state-icon',
            'pdf-error-state-warning-icon',
            iconClassName
          )}
        >
          <MaterialIcon type={iconType} />
        </div>
        <div className="pdf-error-state-text">
          <p className="pdf-error-state-label">{title}</p>
          <p className="pdf-error-state-description">{description}</p>
        </div>
        {actions}
      </div>
      {extraContent}
    </div>
  )
}
export default PdfErrorState
