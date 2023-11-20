import { Trans } from 'react-i18next'

function PremiumFeaturesLink() {
  const featuresPageLink = (
    // translation adds content
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a href="/about/features-overview" />
  )

  return (
    <p>
      <Trans
        i18nKey="get_most_subscription_by_checking_features"
        components={[featuresPageLink]}
      />
    </p>
  )
}

export default PremiumFeaturesLink
