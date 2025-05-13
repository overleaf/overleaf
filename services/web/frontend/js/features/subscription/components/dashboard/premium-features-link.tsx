import { Trans } from 'react-i18next'
import { Subscription } from '../../../../../../types/subscription/dashboard/subscription'
import { AI_ADD_ON_CODE, isStandaloneAiPlanCode } from '../../data/add-on-codes'

function PremiumFeaturesLink({
  subscription,
}: {
  subscription?: Subscription
}) {
  const hasAiAddon = subscription?.addOns?.some(
    addOn => addOn.addOnCode === AI_ADD_ON_CODE
  )
  const onAiStandalonePlan = isStandaloneAiPlanCode(subscription?.planCode)

  if (onAiStandalonePlan) {
    return (
      <p>
        <Trans
          i18nKey="get_most_subscription_by_checking_ai_writefull"
          components={[
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a href="/learn/latex/Error_Assist" />,
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a
              href="https://help.writefull.com/writefull-for-overleaf--user-guide"
              target="_blank"
              rel="noopener"
            />,
          ]}
        />
      </p>
    )
  }

  if (hasAiAddon) {
    return (
      <p>
        <Trans
          i18nKey="get_most_subscription_by_checking_overleaf_ai_writefull"
          components={[
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a href="/learn/how-to/Overleaf_premium_features" />,
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a href="/learn/latex/Error_Assist" />,
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a
              href="https://help.writefull.com/writefull-for-overleaf--user-guide"
              target="_blank"
              rel="noopener"
            />,
          ]}
        />
      </p>
    )
  }

  return (
    <p>
      <Trans
        i18nKey="get_most_subscription_by_checking_overleaf"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/learn/how-to/Overleaf_premium_features" />,
        ]}
      />
    </p>
  )
}

export default PremiumFeaturesLink
