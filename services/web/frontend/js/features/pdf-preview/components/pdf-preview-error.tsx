import { useTranslation, Trans } from 'react-i18next'
import { memo, useCallback } from 'react'
import OLButton from '@/features/ui/components/ol/ol-button'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import getMeta from '../../../utils/meta'

function PdfPreviewError({ error }: { error: string }) {
  const { t } = useTranslation()

  const { startCompile } = useCompileContext()

  switch (error) {
    case 'rendering-error-expected':
      return (
        <PdfLogEntry
          headerTitle={t('pdf_rendering_error')}
          formattedContent={
            <>
              <Trans
                i18nKey="something_went_wrong_rendering_pdf_expected"
                components={[
                  // eslint-disable-next-line react/jsx-key
                  <OLButton
                    variant="info"
                    size="sm"
                    bs3Props={{ bsSize: 'xsmall' }}
                    onClick={() => startCompile()}
                  />,
                ]}
              />
              <br />
              <br />
              <Trans
                i18nKey="last_resort_trouble_shooting_guide"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content
                  <a
                    href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                    target="_blank"
                    key="troubleshooting-link"
                  />,
                ]}
              />
            </>
          }
          level="warning"
        />
      )

    case 'rendering-error':
      return (
        <ErrorLogEntry title={t('pdf_rendering_error')}>
          {t('something_went_wrong_rendering_pdf')}
          &nbsp;
          <Trans
            i18nKey="try_recompile_project_or_troubleshoot"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              <a
                href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                target="_blank"
                key="troubleshooting-link"
              />,
            ]}
          />
          {getMeta('ol-compilesUserContentDomain') && (
            <>
              <br />
              <br />
              <Trans
                i18nKey="new_compile_domain_notice"
                values={{
                  compilesUserContentDomain: new URL(
                    getMeta('ol-compilesUserContentDomain')
                  ).hostname,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
                components={[
                  <code key="domain" />,
                  /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                  <a
                    href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                    target="_blank"
                    key="troubleshooting-link"
                  />,
                ]}
              />
            </>
          )}
        </ErrorLogEntry>
      )

    case 'clsi-maintenance':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('clsi_maintenance')}
        </ErrorLogEntry>
      )

    case 'clsi-unavailable':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('clsi_unavailable')}
        </ErrorLogEntry>
      )

    case 'too-recently-compiled':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('too_recently_compiled')}
        </ErrorLogEntry>
      )

    case 'terminated':
      return (
        <ErrorLogEntry title={t('terminated')}>
          {t('compile_terminated_by_user')}
        </ErrorLogEntry>
      )

    case 'rate-limited':
      return (
        <ErrorLogEntry title={t('pdf_compile_rate_limit_hit')}>
          {t('project_flagged_too_many_compiles')}
        </ErrorLogEntry>
      )

    case 'compile-in-progress':
      return (
        <ErrorLogEntry title={t('pdf_compile_in_progress_error')}>
          {t('pdf_compile_try_again')}
        </ErrorLogEntry>
      )

    case 'autocompile-disabled':
      return (
        <ErrorLogEntry title={t('autocompile_disabled')}>
          {t('autocompile_disabled_reason')}
        </ErrorLogEntry>
      )

    case 'project-too-large':
      return (
        <ErrorLogEntry title={t('project_too_large')}>
          {t('project_too_much_editable_text')}
        </ErrorLogEntry>
      )

    case 'timedout':
      return <TimedOutLogEntry />

    case 'failure':
      return (
        <ErrorLogEntry title={t('no_pdf_error_title')}>
          {t('no_pdf_error_explanation')}

          <ul className="my-1 ps-3">
            <li>{t('no_pdf_error_reason_unrecoverable_error')}</li>
            <li>
              <Trans
                i18nKey="no_pdf_error_reason_no_content"
                components={{ code: <code /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="no_pdf_error_reason_output_pdf_already_exists"
                components={{ code: <code /> }}
              />
            </li>
          </ul>
        </ErrorLogEntry>
      )

    case 'clear-cache':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('somthing_went_wrong_compiling')}
        </ErrorLogEntry>
      )

    case 'pdf-viewer-loading-error':
      return (
        <ErrorLogEntry title={t('pdf_rendering_error')}>
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
        </ErrorLogEntry>
      )

    case 'validation-problems':
      return null // handled elsewhere

    case 'error':
    default:
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('somthing_went_wrong_compiling')}
        </ErrorLogEntry>
      )
  }
}

export default memo(PdfPreviewError)

function ErrorLogEntry({
  title,
  headerIcon,
  children,
}: {
  title: string
  headerIcon?: React.ReactElement
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <PdfLogEntry
      headerTitle={title}
      headerIcon={headerIcon}
      formattedContent={children}
      entryAriaLabel={t('compile_error_entry_description')}
      level="error"
    />
  )
}

function TimedOutLogEntry() {
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
    <ErrorLogEntry title={t('timedout')}>
      <p>{t('project_timed_out_intro')}</p>
      <ul>
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
                    variant="info"
                    size="sm"
                    bs3Props={{ bsSize: 'xsmall' }}
                    onClick={handleEnableStopOnFirstErrorClick}
                  />,
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
            <a href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F" />,
          ]}
        />
      </p>
    </ErrorLogEntry>
  )
}
