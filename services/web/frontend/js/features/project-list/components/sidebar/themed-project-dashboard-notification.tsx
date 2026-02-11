import Close from '@/shared/components/close'
import OLButton from '@/shared/components/ol/ol-button'
import { useUserContext } from '@/shared/context/user-context'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import { Overlay, Popover } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

// TODO: Update this before release
const NEW_USER_CUTOFF_DATE = new Date('2026-02-15')

type ThemedProjectDashboardNotificationProps = {
  target: HTMLElement | null
  show: boolean
  onDismiss: () => void
}
export const ThemedProjectDashboardNotification = ({
  target,
  show,
  onDismiss,
}: ThemedProjectDashboardNotificationProps) => {
  const theme = useActiveOverallTheme('themed-project-dashboard')
  const {
    userSettings: { overallTheme },
  } = useUserSettingsContext()
  const { signUpDate: signUpDateString } = useUserContext()
  const signUpDate = signUpDateString ? new Date(signUpDateString) : new Date(0)
  const isNewUser = signUpDate > NEW_USER_CUTOFF_DATE
  const { t } = useTranslation()

  if (!target) {
    return null
  }

  if (!show) {
    return null
  }

  let content
  switch (true) {
    case overallTheme === 'system':
      content = {
        header: t('a_dashboard_that_follows_your_lead'),
        body: t(
          'your_dashboard_is_set_to_match_your_system_theme_automatically_want_a_different_look_pick_your_favorite_theme_here'
        ),
      }
      break
    case isNewUser && theme === 'dark':
      content = {
        header: t('meet_the_new_dark_dashboard'),
        body: t(
          'weve_set_your_dashboard_to_dark_mode_to_help_you_stay_focused_if_youre_a_fan_of_a_lighter_look_you_can_easily_switch_themes_here'
        ),
      }
      break
    case theme === 'dark':
      content = {
        header: t('welcome_to_the_dark_side'),
        body: t(
          'weve_given_your_dashboard_a_sleek_new_dark_theme_for_more_comfortable_late_night_research_prefer_the_light_switch_back_anytime_right_here'
        ),
      }
      break
    case theme === 'light':
      content = {
        header: t('fancy_going_dark'),
        body: t(
          'weve_matched_your_dashboard_theme_to_your_editor_preferences_but_you_can_change_that_here_anytime'
        ),
      }
      break
    default:
      content = { header: '', body: '' }
  }

  if (!content.header || !content.body) {
    return null
  }

  return (
    <Overlay show placement="right" target={target} onHide={onDismiss}>
      <Popover className="themed-dashboard-intro-popover">
        <Popover.Header>
          {content.header}
          <Close
            variant={theme === 'light' ? 'dark' : 'light'}
            onDismiss={onDismiss}
          />
        </Popover.Header>
        <Popover.Body>
          {content.body}
          <div className="d-flex justify-content-end">
            <OLButton onClick={onDismiss} variant="link">
              {t('got_it')}
            </OLButton>
          </div>
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
