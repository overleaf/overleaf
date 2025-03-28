import { Trans } from 'react-i18next'

function PremiumFeaturesLink() {
  return (
    <p>
      <Trans
        i18nKey="get_most_subscription_discover_premium_features"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/learn/how-to/Overleaf_premium_features" />,
        ]}
      />
    </p>
  )
}

export default PremiumFeaturesLink
