import { Trans } from 'react-i18next'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function PremiumFeaturesLink() {
  const isFlexibleGroupLicensing = useFeatureFlag('flexible-group-licensing')

  return (
    <p>
      {isFlexibleGroupLicensing ? (
        <Trans
          i18nKey="get_most_subscription_discover_premium_features"
          components={[
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a href="/learn/how-to/Overleaf_premium_features" />,
          ]}
        />
      ) : (
        <Trans
          i18nKey="get_most_subscription_by_checking_features"
          components={[
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a href="/about/features-overview" />,
          ]}
        />
      )}
    </p>
  )
}

export default PremiumFeaturesLink
