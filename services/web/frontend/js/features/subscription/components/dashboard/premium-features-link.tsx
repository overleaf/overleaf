import { Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import * as eventTracking from '../../../../infrastructure/event-tracking'

function PremiumFeaturesLink() {
  const featuresPageVariant =
    getMeta('ol-splitTestVariants')?.['features-page'] || 'default'

  function handleLinkClick() {
    eventTracking.sendMB('features-page-link', {
      splitTest: 'features-page',
      splitTestVariant: featuresPageVariant,
    })
  }

  const featuresPageLink = (
    // translation adds content
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      href={
        featuresPageVariant === 'new'
          ? '/about/features-overview'
          : '/learn/how-to/Overleaf_premium_features'
      }
      onClick={handleLinkClick}
    />
  )

  if (featuresPageVariant === 'new') {
    return (
      <p>
        <Trans
          i18nKey="get_most_subscription_by_checking_features"
          components={[featuresPageLink]}
        />
      </p>
    )
  }

  return (
    <p>
      <Trans
        i18nKey="get_most_subscription_by_checking_premium_features"
        components={[featuresPageLink]}
      />
    </p>
  )
}

export default PremiumFeaturesLink
