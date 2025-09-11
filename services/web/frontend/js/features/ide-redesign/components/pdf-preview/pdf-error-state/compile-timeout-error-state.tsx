import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useStopOnFirstError } from '@/shared/hooks/use-stop-on-first-error'
import { useCallback, useMemo } from 'react'
import ErrorState from './error-state'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import getMeta from '@/utils/meta'
import {
  populateEditorRedesignSegmentation,
  useEditorAnalytics,
} from '@/shared/hooks/use-editor-analytics'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

export const ShortCompileTimeoutErrorState = () => {
  const { t } = useTranslation()
  const { isProjectOwner } = useCompileContext()
  const { sendEvent } = useEditorAnalytics()
  const newEditor = useIsNewEditorEnabled()

  const { compileTimeout } = getMeta('ol-compileSettings')
  const segmentation = useMemo(
    () =>
      populateEditorRedesignSegmentation(
        {
          'is-owner': isProjectOwner,
          compileTime: compileTimeout,
          location: 'error-state',
        },
        newEditor
      ),
    [isProjectOwner, compileTimeout, newEditor]
  )

  const sendInfoClickEvent = useCallback(() => {
    sendEvent('paywall-info-click', {
      ...segmentation,
      'paywall-type': 'compile-timeout',
      content: 'blog',
    })
  }, [segmentation, sendEvent])

  return (
    <ErrorState
      title={t('your_compile_timed_out')}
      description={
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
        </>
      }
      iconType="running_with_errors"
      extraContent={
        <div className="pdf-error-state-info-box">
          <p>
            <em>
              <Trans
                i18nKey="were_reducing_compile_timeout"
                components={[
                  /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                  <a
                    aria-label={t(
                      'read_more_about_free_compile_timeouts_servers'
                    )}
                    href="/blog/changes-to-free-compile-timeout"
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={sendInfoClickEvent}
                  />,
                ]}
              />
            </em>
          </p>
          <ReasonsForTimeoutInfo />
        </div>
      }
      actions={
        isProjectOwner && (
          <StartFreeTrialButton
            source="compile-timeout"
            buttonProps={{ variant: 'premium', size: 'sm' }}
            segmentation={segmentation}
          >
            {t('start_a_free_trial')}
          </StartFreeTrialButton>
        )
      }
    />
  )
}

export const LongCompileTimeoutErrorState = () => {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('your_compile_timed_out')}
      description={t('project_timed_out_intro_short')}
      iconType="running_with_errors"
      extraContent={
        <div className="pdf-error-state-info-box">
          <ReasonsForTimeoutInfo />
        </div>
      }
    />
  )
}

const ReasonsForTimeoutInfo = () => {
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
    <>
      <div className="pdf-error-state-info-box-title">
        <MaterialIcon type="info" unfilled />
        {t('common_causes_of_compile_timeouts_include')}:
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
              i18nKey="a_fatal_compile_error_that_completely_blocks_compilation"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F#Fatal_compile_errors_blocking_the_compilation" />,
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
              <a
                href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
                rel="noopener noreferrer"
                target="_blank"
              />,
            ]}
          />
        </p>
      </div>
    </>
  )
}
