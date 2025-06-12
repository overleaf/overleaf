import getMeta from '@/utils/meta'
import { Trans, useTranslation } from 'react-i18next'
import { memo, useMemo } from 'react'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import MaterialIcon from '@/shared/components/material-icon'
import * as eventTracking from '@/infrastructure/event-tracking'
import PdfLogEntry from './pdf-log-entry'

type TimeoutMessageProps = {
  segmentation?: eventTracking.Segmentation
}

function TimeoutMessageAfterPaywallDismissal({
  segmentation,
}: TimeoutMessageProps) {
  const { lastCompileOptions, isProjectOwner } = useDetachCompileContext()
  return (
    <div className="website-redesign timeout-upgrade-paywall-prompt">
      <CompileTimeout
        isProjectOwner={isProjectOwner}
        segmentation={segmentation}
      />
      {getMeta('ol-ExposedSettings').enableSubscriptions && (
        <PreventTimeoutHelpMessage
          lastCompileOptions={lastCompileOptions}
          segmentation={segmentation}
        />
      )}
    </div>
  )
}

type CompileTimeoutProps = {
  isProjectOwner: boolean
  segmentation?: eventTracking.Segmentation
}

const CompileTimeout = memo(function CompileTimeout({
  isProjectOwner,
  segmentation,
}: CompileTimeoutProps) {
  const { t } = useTranslation()

  const eventSegmentation = useMemo(
    () => ({
      ...segmentation,
      'paywall-version': 'secondary',
    }),
    [segmentation]
  )

  return (
    <PdfLogEntry
      headerTitle={t('project_failed_to_compile')}
      headerIcon={
        <MaterialIcon
          type="error"
          className="log-entry-header-title"
          size="2x"
          unfilled
        />
      }
      formattedContent={
        getMeta('ol-ExposedSettings').enableSubscriptions && (
          <>
            <p className="compile-timeout-message">
              {isProjectOwner ? (
                <div>
                  <p>{t('your_project_need_more_time_to_compile')}</p>
                  <p>{t('upgrade_to_unlock_more_time')}</p>
                </div>
              ) : (
                <div>
                  <p>{t('this_project_need_more_time_to_compile')}</p>
                  <p>{t('upgrade_to_unlock_more_time')}</p>
                </div>
              )}
            </p>

            {isProjectOwner === false && (
              <Trans
                i18nKey="tell_the_project_owner_and_ask_them_to_upgrade"
                components={[
                  // eslint-disable-next-line react/jsx-key
                  <strong />,
                ]}
              />
            )}

            {isProjectOwner && (
              <div className="log-entry-cta-container">
                <StartFreeTrialButton
                  source="compile-timeout"
                  buttonProps={{ variant: 'secondary' }}
                  segmentation={eventSegmentation}
                >
                  {t('try_for_free')}
                </StartFreeTrialButton>
              </div>
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
  segmentation?: eventTracking.Segmentation
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  lastCompileOptions,
  segmentation,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()

  function sendInfoClickEvent() {
    eventTracking.sendMB('paywall-info-click', {
      'paywall-type': 'compile-timeout',
      content: 'blog',
      ...segmentation,
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
              {t('large_or_high_resolution_images_taking_too_long_to_process')}
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
                    i18nKey="enable_stop_on_first_error_under_recompile_dropdown_menu_v2"
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <strong className="log-bold-text" />,
                      // eslint-disable-next-line react/jsx-key
                      <strong className="log-bold-text" />,
                    ]}
                  />{' '}
                </>
              )}
            </li>
          </ul>
          <p className="mb-0">
            <Trans
              i18nKey="learn_more_about_compile_timeouts"
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

export default memo(TimeoutMessageAfterPaywallDismissal)
