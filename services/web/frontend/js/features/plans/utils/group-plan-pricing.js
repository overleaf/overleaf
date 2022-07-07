import getMeta from '../../../utils/meta'

// plan: 'collaborator' or 'professional'
// the rest of available arguments can be seen in the groupPlans value
export function createLocalizedGroupPlanPrice({
  plan,
  licenseSize,
  currency,
  usage,
}) {
  const groupPlans = getMeta('ol-groupPlans')
  const currencySymbols = getMeta('ol-currencySymbols')
  const priceInCents =
    groupPlans[usage][plan][currency][licenseSize].price_in_cents

  const price = priceInCents / 100
  const perUserPrice = price / parseInt(licenseSize)

  const strPrice = price.toFixed()
  let strPerUserPrice = ''

  if (Number.isInteger(perUserPrice)) {
    strPerUserPrice = String(perUserPrice)
  } else {
    strPerUserPrice = perUserPrice.toFixed(2)
  }

  const currencySymbol = currencySymbols[currency]

  switch (currencySymbol) {
    case 'Fr':
      return {
        localizedPrice: `${currencySymbol} ${strPrice}`,
        localizedPerUserPrice: `${currencySymbol} ${strPerUserPrice}`,
      }
    case 'kr':
      return {
        localizedPrice: `${strPrice} ${currencySymbol}`,
        localizedPerUserPrice: `${strPerUserPrice} ${currencySymbol}`,
      }
    default: {
      return {
        localizedPrice: `${currencySymbol}${strPrice}`,
        localizedPerUserPrice: `${currencySymbol}${strPerUserPrice}`,
      }
    }
  }
}
