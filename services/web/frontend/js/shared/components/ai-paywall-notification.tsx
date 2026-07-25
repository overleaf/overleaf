import { useEffect } from 'react'
import Notification from '@/shared/components/notification'
import PaywallUpgradeButton from '@/shared/components/paywall-upgrade-button'
import { useEditorContext } from '@/shared/context/editor-context'
import { useUserFeaturesContext } from '@/shared/context/user-features-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useTranslation } from 'react-i18next'
import { formatSecondsToHoursAndMinutes } from '@/shared/utils/time'

import getMeta from '@/utils/meta'
const hasUnlimitedAi = getMeta('ol-hasUnlimitedAi')

type AiFeatureLocations = 'errorAssist' | 'workbench'
type PaywallType = 'assistant' | 'workbench'

const paywallTypeByLocation: Record<AiFeatureLocations, PaywallType> = {
  workbench: 'workbench',
  errorAssist: 'assistant',
}

function AiPaywallNotification({
  isActionBelowContent = false,
  featureLocation,
}: {
  isActionBelowContent?: boolean
  featureLocation: AiFeatureLocations
}) {
  const {
    hasSuggestionsLeft,
    hasTokensLeft,
    tokenResetDate,
    premiumSuggestionResetDate,
  } = useEditorContext()

  const features = useUserFeaturesContext()
  const user = getMeta('ol-user')

  const isCommons = user.hasInstitutionLicence
  const isGroupUser = user.isMemberOfGroupSubscription

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

  if (hasAddOn) {
    return (
      <FairUseLimit
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
      />
    )
  }

  if (isGroupUser) {
    return (
      <GroupsPaywall
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
      />
    )
  }

  if (isCommons) {
    return (
      <CommonsPaywall
        secondsTillReset={secondsTillReset}
        featureLocation={featureLocation}
      />
    )
  }
  return (
    <UpgradePaywall
      secondsTillReset={secondsTillReset}
      isActionBelowContent={isActionBelowContent}
      featureLocation={featureLocation}
    />
  )
}

function GroupsPaywall({
  secondsTillReset,
  featureLocation,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
}) {
  const { t } = useTranslation()

  const message = t('your_limit_will_reset_in_time_or_speak_to_admin', {
    time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
  })

  const title =
    featureLocation === 'workbench'
      ? t('youve_reached_your_daily_ai_limit')
      : t('youve_hit_your_daily_ai_limit')

  return (
    <>
      <Notification
        type="info"
        title={title}
        content={message}
        isDismissible={false}
        customIcon={null}
        className="ai-paywall-notification"
      />
    </>
  )
}

function CommonsPaywall({
  secondsTillReset,
  featureLocation,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
}) {
  const { t } = useTranslation()

  // workbench isnt available on commons plans, so dont show it here and let upgrade-notification handle it
  if (featureLocation === 'workbench') {
    return null
  }

  const message = t('this_will_reset_in', {
    time: formatSecondsToHoursAndMinutes(t, secondsTillReset),
  })

  return (
    <>
      <Notification
        type="info"
        title={t('youve_reached_your_ai_usage_limit')}
        content={message}
        isDismissible={false}
        customIcon={null}
        className="ai-paywall-notification"
      />
    </>
  )
}

function FairUseLimit({
  secondsTillReset,
  featureLocation,
}: {
  secondsTillReset: number
  featureLocation: AiFeatureLocations
}) {
  const { t } = useTranslation()

  const title =
    featureLocation === 'workbench'
      ? t('usage_limit_reached')
      : t('youve_reached_the_fair_usage')

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
        customIcon={null}
        className="ai-paywall-notification"
      />
    </>
  )
}

function UpgradePaywall({
  secondsTillReset,
  isActionBelowContent,
  featureLocation,
}: {
  secondsTillReset: number
  isActionBelowContent: boolean
  featureLocation: AiFeatureLocations
}) {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const paywallType = paywallTypeByLocation[featureLocation]

  useEffect(() => {
    sendEvent('paywall-prompt', {
      'paywall-type': paywallType,
    })
  }, [sendEvent, paywallType])

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
