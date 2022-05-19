const GroupPlansData = require('./GroupPlansData')
const Settings = require('@overleaf/settings')

/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return oldPlan.price_in_cents > newPlan.price_in_cents
}

function generateInitialLocalizedGroupPrice(recommendedCurrency) {
  const INITIAL_LICENSE_SIZE = 2
  const currencySymbols = Settings.groupPlanModalOptions.currencySymbols
  const recommendedCurrencySymbol = currencySymbols[recommendedCurrency]

  // the price is in cents, so divide by 100 to get the value
  const collaboratorPrice =
    GroupPlansData.enterprise.collaborator[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const collaboratorPricePerUser = collaboratorPrice / INITIAL_LICENSE_SIZE
  const professionalPrice =
    GroupPlansData.enterprise.professional[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const professionalPricePerUser = professionalPrice / INITIAL_LICENSE_SIZE

  switch (recommendedCurrency) {
    case 'CHF': {
      return {
        price: {
          collaborator: `${recommendedCurrencySymbol} ${collaboratorPrice}`,
          professional: `${recommendedCurrencySymbol} ${professionalPrice}`,
        },
        pricePerUser: {
          collaborator: `${recommendedCurrencySymbol} ${collaboratorPricePerUser}`,
          professional: `${recommendedCurrencySymbol} ${professionalPricePerUser}`,
        },
      }
    }
    case 'DKK':
    case 'NOK':
    case 'SEK':
      return {
        price: {
          collaborator: `${collaboratorPrice} ${recommendedCurrencySymbol}`,
          professional: `${professionalPrice} ${recommendedCurrencySymbol}`,
        },
        pricePerUser: {
          collaborator: `${collaboratorPricePerUser} ${recommendedCurrencySymbol}`,
          professional: `${professionalPricePerUser} ${recommendedCurrencySymbol}`,
        },
      }
    default: {
      return {
        price: {
          collaborator: `${recommendedCurrencySymbol}${collaboratorPrice}`,
          professional: `${recommendedCurrencySymbol}${professionalPrice}`,
        },
        pricePerUser: {
          collaborator: `${recommendedCurrencySymbol}${collaboratorPricePerUser}`,
          professional: `${recommendedCurrencySymbol}${professionalPricePerUser}`,
        },
      }
    }
  }
}

module.exports = {
  shouldPlanChangeAtTermEnd,
  generateInitialLocalizedGroupPrice,
}
