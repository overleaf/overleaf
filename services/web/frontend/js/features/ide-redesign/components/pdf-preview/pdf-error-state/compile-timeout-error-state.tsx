import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { upgradePlan } from '@/main/account-upgrade'
import { useStopOnFirstError } from '@/shared/hooks/use-stop-on-first-error'
import { useCallback } from 'react'
import ErrorState from './error-state'

export const ShortCompileTimeoutErrorState = () => {
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

export const LongCompileTimeoutErrorState = () => {
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
