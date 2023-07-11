import getMeta from '../../../utils/meta'

const LOCALES = {
  BRL: 'pt-BR',
  MXN: 'es-MX',
  COP: 'es-CO',
  CLP: 'es-CL',
  PEN: 'es-PE',
}

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

  switch (currency) {
    case 'BRL':
    case 'MXN':
    case 'COP':
    case 'CLP':
    case 'PEN':
      // Test using toLocaleString to format currencies for new LATAM regions
      return {
        localizedPrice: price.toLocaleString(LOCALES[currency], {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
        }),
        localizedPerUserPrice: perUserPrice.toLocaleString(LOCALES[currency], {
          style: 'currency',
          currency,
          minimumFractionDigits: Number.isInteger(perUserPrice) ? 0 : null,
        }),
      }
    case 'CHF':
      return {
        localizedPrice: `${currencySymbol} ${strPrice}`,
        localizedPerUserPrice: `${currencySymbol} ${strPerUserPrice}`,
      }
    case 'DKK':
    case 'SEK':
    case 'NOK':
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
