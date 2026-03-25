import Notification from '@/shared/components/notification'
import UpgradeButton from '@/features/ide-react/components/toolbar/upgrade-button'
import { useEditorContext } from '@/shared/context/editor-context'
import { useUserFeaturesContext } from '@/shared/context/user-features-context'
import { useTranslation } from 'react-i18next'
import { formatSecondsToHoursAndMinutes } from '@/shared/utils/time'
import { useFeatureFlag } from '@/shared/context/split-test-context'

import getMeta from '@/utils/meta'
const hasUnlimitedAi = getMeta('ol-hasUnlimitedAi')

type aiFeatureLocations = 'errorAssist' | 'workbench'

function AiPaywallNotification({
  isActionBelowContent = false,
  featureLocation,
}: {
  isActionBelowContent?: boolean
  featureLocation: aiFeatureLocations
}) {
  const {
    hasSuggestionsLeft,
    hasTokensLeft,
    tokenResetDate,
    premiumSuggestionResetDate,
  } = useEditorContext()

  const { t } = useTranslation()
  const features = useUserFeaturesContext()
  const inQuotaRollout = useFeatureFlag('plans-2026-phase-1')

  if (!getMeta('ol-showAiFeatures')) {
    return null
  }

  // todo: quota clean-up: remove once we are transitioned off aiErrorAssistant naming and replace with just hasUnlimitedAi, also remove null FF check
  const hasAddOn = hasUnlimitedAi || Boolean(features?.aiErrorAssistant)

  // error assist only needs usage quota
  const canUseErrorAssist = hasSuggestionsLeft
  if (canUseErrorAssist && featureLocation === 'errorAssist') {
    return null
  }

  // workbench needs both tokens and usage quota
  const canUseWorkbench = hasSuggestionsLeft && hasTokensLeft
  if (canUseWorkbench && featureLocation === 'workbench') {
    return null
  }

  const exceededQuotaDates = [
    ...(hasSuggestionsLeft ? [] : [premiumSuggestionResetDate]),
    ...(hasTokensLeft ? [] : [tokenResetDate]),
  ]

  const longestResetDate = exceededQuotaDates.reduce((latest, date) =>
    date > latest ? date : latest
  )

  const secondsTillReset =
    (longestResetDate.getTime() - new Date().getTime()) / 1000

  // if we should have refreshed already remove paywall
  if (secondsTillReset <= 0) {
    return null
  }

  // if not in rollout, use old paywalls for free users
  if (!inQuotaRollout && !hasAddOn) {
    return null
  }

  if (!inQuotaRollout) {
    // if not in rollout, we can still use our fair usage messages
    const chattingMessage = t(
      'youve_reached_the_fair_usage_limit_on_your_plan_you_can_start_chatting_again_in_time',
      {
        time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
      }
    )
    const assistMessage = t('youve_reached_the_ai_fair_usage')
    return (
      <Notification
        type="info"
        title={t('usage_limit_reached')}
        content={
          featureLocation === 'workbench' ? chattingMessage : assistMessage
        }
        isDismissible={false}
      />
    )
  }

  if (hasAddOn) {
    return (
      <FairUseLimit
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
      />
    )
  }
  const message = t('upgrade_for_unlimited_access_to_ai', {
    time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
  })
  return (
    <>
      <Notification
        type="info"
        title={t('youve_hit_your_overleaf_ai_limit')}
        content={message}
        isDismissible={false}
        customIcon={null}
        isActionBelowContent={isActionBelowContent}
        action={
          <UpgradeButton
            className="px-2.5 py-2"
            referrer="ai"
            source={featureLocation}
          />
        }
        className="ai-upgrade-paywall-btn"
      />
    </>
  )
}

function FairUseLimit({
  secondsTillReset,
  featureLocation,
}: {
  secondsTillReset: number
  featureLocation: aiFeatureLocations
}) {
  const { t } = useTranslation()

  const title =
    featureLocation === 'workbench'
      ? t('usage_limit_reached')
      : t('youve_reached_the_ai_fair_usage')

  const workbenchMessage = t(
    'youve_reached_the_fair_usage_limit_on_your_plan_you_can_start_chatting_again_in_time',
    {
      time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
    }
  )

  const assistMessage = t('this_will_reset_in', {
    time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
  })
  const message =
    featureLocation === 'workbench' ? workbenchMessage : assistMessage

  return (
    <>
      <Notification
        type="info"
        title={title}
        content={message}
        isDismissible={false}
      />
    </>
  )
}

export default AiPaywallNotification
