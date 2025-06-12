import Notification from '@/shared/components/notification'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import { Trans, useTranslation } from 'react-i18next'
import * as eventTracking from '@/infrastructure/event-tracking'
import { FC } from 'react'

export const CompileTimeoutChangingSoon: FC<{
  isProjectOwner?: boolean
  handleDismissChangingSoon: () => void
  segmentation?: eventTracking.Segmentation
}> = ({ isProjectOwner = false, handleDismissChangingSoon, segmentation }) => {
  const { t } = useTranslation()

  const sendInfoClickEvent = () => {
    eventTracking.sendMB('paywall-info-click', {
      'paywall-type': 'compile-time-warning',
      ...segmentation,
      content: 'blog',
    })
  }

  const compileTimeoutChangesBlogLink = (
    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
    <a
      aria-label={t('read_more_about_compile_timeout_changes')}
      href="/blog/changes-to-free-compile-timeout"
      key="compileTimeoutBlogLink1"
      rel="noopener noreferrer"
      target="_blank"
      onClick={sendInfoClickEvent}
    />
  )

  const fixingCompileTimeoutsLearnLink = (
    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
    <a
      aria-label={t('read_more_about_fix_prevent_timeout')}
      href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
      key="compileTimeoutBlogLink2"
      target="_blank"
      rel="noopener noreferrer"
    />
  )

  if (isProjectOwner) {
    return (
      <Notification
        action={
          <StartFreeTrialButton
            segmentation={segmentation}
            source="compile-time-warning"
            buttonProps={{
              variant: 'secondary',
              size: 'sm',
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
                i18nKey="introducing_shorter_compile_timeout"
                components={[compileTimeoutChangesBlogLink]}
              />
            </p>
            <p className="row-spaced">
              <Trans
                i18nKey="you_may_be_able_to_fix_issues_to_speed_up_the_compile"
                components={[fixingCompileTimeoutsLearnLink]}
              />{' '}
              <Trans
                i18nKey="and_upgrade_for_compile_time"
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
              i18nKey="introducing_shorter_compile_timeout"
              components={[compileTimeoutChangesBlogLink]}
            />{' '}
            <Trans
              i18nKey="you_may_be_able_to_fix_issues_to_speed_up_the_compile"
              components={[fixingCompileTimeoutsLearnLink]}
            />
          </p>
          <p className="row-spaced">
            <Trans
              i18nKey="tell_the_project_owner_and_ask_them_to_upgrade"
              components={[
                // eslint-disable-next-line react/jsx-key
                <strong />,
              ]}
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
