import Notification from '@/shared/components/notification'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import { Trans, useTranslation } from 'react-i18next'
import * as eventTracking from '@/infrastructure/event-tracking'
import { FC } from 'react'

const sendInfoClickEvent = () => {
  eventTracking.sendMB('paywall-info-click', {
    'paywall-type': 'compile-time-warning',
    content: 'blog',
  })
}

export const CompileTimeoutChangingSoon: FC<{
  isProjectOwner?: boolean
  handleDismissChangingSoon: () => void
}> = ({ isProjectOwner = false, handleDismissChangingSoon }) => {
  const { t } = useTranslation()

  const compileTimeoutBlogLinks = [
    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
    <a
      aria-label={t('read_more_about_free_compile_timeouts_servers')}
      href="/blog/changes-to-free-compile-timeouts-and-servers"
      key="compileTimeoutBlogLink1"
      rel="noopener noreferrer"
      target="_blank"
      onClick={sendInfoClickEvent}
    />,
    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
    <a
      aria-label={t('read_more_about_fix_prevent_timeout')}
      href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
      key="compileTimeoutBlogLink2"
      target="_blank"
      rel="noopener noreferrer"
    />,
  ]

  if (isProjectOwner) {
    return (
      <Notification
        action={
          <StartFreeTrialButton
            variant="new-changing"
            source="compile-time-warning"
            buttonProps={{
              className: 'btn-secondary-compile-timeout-override',
            }}
          >
            {t('start_free_trial_without_exclamation')}
          </StartFreeTrialButton>
        }
        ariaLive="polite"
        content={
          <div>
            <p>
              <Trans
                i18nKey="compile_timeout_will_be_reduced_project_exceeds_limit_speed_up_compile"
                components={compileTimeoutBlogLinks}
                values={{ date: 'October 27 2023' }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />{' '}
              <Trans
                i18nKey="and_you_can_upgrade_for_plenty_more_compile_time"
                components={{ strong: <strong /> }}
              />
            </p>
          </div>
        }
        title={t('your_project_compiled_but_soon_might_not')}
        type="warning"
        isActionBelowContent
        isDismissible
        onDismiss={handleDismissChangingSoon}
      />
    )
  }

  return (
    <Notification
      ariaLive="polite"
      content={
        <div>
          <p>
            <Trans
              i18nKey="compile_timeout_will_be_reduced_project_exceeds_limit_speed_up_compile"
              components={compileTimeoutBlogLinks}
              values={{ date: 'October 27 2023' }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </p>
          <p className="row-spaced">
            <Trans
              i18nKey="tell_the_project_owner_to_upgrade_plan_for_more_compile_time"
              components={{ strong: <strong /> }}
            />
          </p>
        </div>
      }
      title={t('this_project_compiled_but_soon_might_not')}
      type="warning"
      isDismissible
      onDismiss={handleDismissChangingSoon}
    />
  )
}
