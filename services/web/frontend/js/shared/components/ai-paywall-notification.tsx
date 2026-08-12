import { useEffect } from 'react'
import Notification from '@/shared/components/notification'
import PaywallUpgradeButton from '@/shared/components/paywall-upgrade-button'
import { useEditorContext } from '@/shared/context/editor-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useTranslation } from 'react-i18next'
import { formatSecondsToHoursAndMinutes } from '@/shared/utils/time'
import getMeta from '@/utils/meta'
import { AiFeatureLocations } from './types/ai'
import {
  getAiPlanTypeWithoutUpgrade,
  paywallTypeByLocation,
} from '../utils/ai-features'

function AiPaywallNotification({
  isActionBelowContent = false,
  featureLocation,
  isVisible = true,
}: {
  isActionBelowContent?: boolean
  featureLocation: AiFeatureLocations
  /**
   * Whether the notification is on screen. Prevents analytics firing for
   * messages on mounted-but-hidden surfaces (e.g. the workbench rail).
   */
  isVisible?: boolean
}) {
  const {
    hasSuggestionsLeft,
    hasTokensLeft,
    tokenResetDate,
    premiumSuggestionResetDate,
  } = useEditorContext()
  const hasAddOn = getMeta('ol-hasUnlimitedAi')

  const user = getMeta('ol-user')

  const isCommons = user.hasInstitutionLicence
  const isGroupUser = user.isMemberOfGroupSubscription

  if (!getMeta('ol-showAiFeatures')) {
    return null
  }

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

  if (hasAddOn) {
    return (
      <FairUseLimit
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
        isVisible={isVisible}
      />
    )
  }

  if (isGroupUser) {
    return (
      <GroupsPaywall
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
        isVisible={isVisible}
      />
    )
  }

  if (isCommons) {
    return (
      <CommonsPaywall
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
        isVisible={isVisible}
      />
    )
  }
  return (
    <UpgradePaywall
      secondsTillReset={secondsTillReset}
      isActionBelowContent={isActionBelowContent}
      featureLocation={featureLocation}
      isVisible={isVisible}
    />
  )
}

// Shared by the variants that offer no way out of the limit. Reports
// `ai-usage-limit-show`, the no-CTA counterpart to UpgradePaywall's
// `paywall-prompt`, so the two events partition every limit message shown.
function AiUsageLimitNotification({
  title,
  content,
  featureLocation,
  isVisible,
}: {
  title: string
  content: string
  featureLocation: AiFeatureLocations
  isVisible: boolean
}) {
  const { sendEvent } = useEditorAnalytics()
  const paywallType = paywallTypeByLocation[featureLocation]
  const hasUnlimitedQuota = getMeta('ol-hasUnlimitedAi')

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const planType = getAiPlanTypeWithoutUpgrade(hasUnlimitedQuota)
    if (!planType) {
      return
    }

    const { planCode } = getMeta('ol-user')
    sendEvent('ai-usage-limit-show', {
      'paywall-type': paywallType,
      'plan-type': planType,
      'plan-code': planCode,
    })
  }, [sendEvent, paywallType, isVisible, hasUnlimitedQuota])

  return (
    <Notification
      type="info"
      title={title}
      content={content}
      isDismissible={false}
      customIcon={null}
      className="ai-paywall-notification"
    />
  )
}

function GroupsPaywall({
  secondsTillReset,
  featureLocation,
  isVisible,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
  isVisible: boolean
}) {
  const { t } = useTranslation()

  return (
    <AiUsageLimitNotification
      featureLocation={featureLocation}
      isVisible={isVisible}
      title={
        featureLocation === 'workbench'
          ? t('youve_reached_your_daily_ai_limit')
          : t('youve_hit_your_daily_ai_limit')
      }
      content={t('your_limit_will_reset_in_time_or_speak_to_admin', {
        time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
      })}
    />
  )
}

function CommonsPaywall({
  secondsTillReset,
  featureLocation,
  isVisible,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
  isVisible: boolean
}) {
  const { t } = useTranslation()

  // workbench isnt available on commons plans, so dont show it here and let upgrade-notification handle it
  if (featureLocation === 'workbench') {
    return null
  }

  return (
    <AiUsageLimitNotification
      featureLocation={featureLocation}
      isVisible={isVisible}
      title={t('youve_reached_your_ai_usage_limit')}
      content={t('this_will_reset_in', {
        time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
      })}
    />
  )
}

function FairUseLimit({
  secondsTillReset,
  featureLocation,
  isVisible,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
  isVisible: boolean
}) {
  const { t } = useTranslation()
  const isWorkbench = featureLocation === 'workbench'
  const time = formatSecondsToHoursAndMinutes(t, secondsTillReset)

  return (
    <AiUsageLimitNotification
      featureLocation={featureLocation}
      isVisible={isVisible}
      title={
        isWorkbench
          ? t('usage_limit_reached')
          : t('youve_reached_the_fair_usage')
      }
      content={
        isWorkbench
          ? t(
              'youve_reached_the_fair_usage_limit_on_your_plan_you_can_start_chatting_again_in_time',
              { time }
            )
          : t('this_will_reset_in', { time })
      }
    />
  )
}

function UpgradePaywall({
  secondsTillReset,
  isActionBelowContent,
  featureLocation,
  isVisible,
}: {
  secondsTillReset: number
  isActionBelowContent: boolean
  featureLocation: AiFeatureLocations
  isVisible: boolean
}) {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const paywallType = paywallTypeByLocation[featureLocation]

  useEffect(() => {
    if (!isVisible) {
      return
    }
    sendEvent('paywall-prompt', {
      'paywall-type': paywallType,
    })
  }, [sendEvent, paywallType, isVisible])

  return (
    <Notification
      type="info"
      title={t('youve_hit_your_daily_ai_limit')}
      content={t('upgrade_for_unlimited_access_to_ai', {
        time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
      })}
      isDismissible={false}
      customIcon={null}
      isActionBelowContent={isActionBelowContent}
      action={
        <PaywallUpgradeButton
          referrer="ai"
          paywallType={paywallType}
          className="px-2.5 py-2"
        />
      }
      className="ai-upgrade-paywall-btn ai-paywall-notification"
    />
  )
}

export default AiPaywallNotification
