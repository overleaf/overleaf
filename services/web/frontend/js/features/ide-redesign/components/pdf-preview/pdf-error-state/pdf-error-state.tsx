import { Trans, useTranslation } from 'react-i18next'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useIsNewEditorEnabled } from '../../../utils/new-editor-utils'
import ErrorState, { CheckLogsButton } from './error-state'
import {
  LongCompileTimeoutErrorState,
  ShortCompileTimeoutErrorState,
} from './compile-timeout-error-state'
import GeneralErrorState from './general-error-state'
import RenderingErrorExpectedState from './rendering-error-expected-state'
import RenderingErrorState from './rendering-error-state'

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
        return <ShortCompileTimeoutErrorState />
      } else {
        return <LongCompileTimeoutErrorState />
      }
    }
    case 'compile-in-progress':
      return (
        <ErrorState
          title={t('pdf_compile_in_progress_error')}
          description={t('pdf_compile_try_again')}
        />
      )
    case 'clsi-maintenance':
      return (
        <ErrorState
          title={t('server_error')}
          description={t('clsi_maintenance')}
          iconType="build"
        />
      )
    case 'clsi-unavailable':
      return (
        <ErrorState
          title={t('server_error')}
          description={t('clsi_unavailable')}
        />
      )
    case 'too-recently-compiled':
      return (
        <ErrorState
          title={t('server_error')}
          description={t('too_recently_compiled')}
        />
      )
    case 'terminated':
      return (
        <ErrorState
          title={t('terminated')}
          description={t('compile_terminated_by_user')}
          actions={<CheckLogsButton />}
        />
      )
    case 'rate-limited':
      return (
        <ErrorState
          title={t('pdf_compile_rate_limit_hit')}
          description={t('project_flagged_too_many_compiles')}
        />
      )
    case 'autocompile-disabled':
      return (
        <ErrorState
          title={t('autocompile_disabled')}
          description={t('autocompile_disabled_reason')}
        />
      )
    case 'project-too-large':
      return (
        <ErrorState
          title={t('project_too_large')}
          description={t('project_too_much_editable_text')}
        />
      )
    case 'clear-cache':
      return (
        <ErrorState
          title={t('server_error')}
          description={t('somthing_went_wrong_compiling')}
        />
      )
    case 'pdf-viewer-loading-error':
      return (
        <ErrorState
          title={t('pdf_rendering_error')}
          description={
            <Trans
              i18nKey="something_went_wrong_loading_pdf_viewer"
              components={[
                <strong key="strong-" />,
                // eslint-disable-next-line jsx-a11y/anchor-has-content
                <a
                  href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                  target="_blank"
                  key="troubleshooting-link"
                />,
                // eslint-disable-next-line jsx-a11y/anchor-has-content
                <a key="contact-link" target="_blank" href="/contact" />,
              ]}
            />
          }
        />
      )
    case 'rendering-error-expected':
      return <RenderingErrorExpectedState />
    case 'rendering-error':
      return <RenderingErrorState />
    default:
      return <GeneralErrorState />
  }
}

export default PdfErrorState
