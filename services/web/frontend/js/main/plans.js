/* eslint-disable
    camelcase,
    max-len
*/
import App from '../base'
import getMeta from '../utils/meta'

App.factory('MultiCurrencyPricing', function () {
  const currencyCode = getMeta('ol-recommendedCurrency')

  return {
    currencyCode,

    plans: {
      USD: {
        symbol: '$',
        student: {
          monthly: '$10',
          annual: '$99',
        },
        personal: {
          monthly: '$15',
          annual: '$139',
        },
        collaborator: {
          monthly: '$23',
          annual: '$219',
        },
        professional: {
          monthly: '$45',
          annual: '$429',
        },
      },
      EUR: {
        symbol: '€',
        student: {
          monthly: '€8',
          annual: '€79',
        },
        personal: {
          monthly: '€14',
          annual: '€129',
        },
        collaborator: {
          monthly: '€21',
          annual: '€199',
        },
        professional: {
          monthly: '€42',
          annual: '€399',
        },
      },
      GBP: {
        symbol: '£',
        student: {
          monthly: '£7',
          annual: '£69',
        },
        personal: {
          monthly: '£12',
          annual: '£114',
        },
        collaborator: {
          monthly: '£18',
          annual: '£169',
        },
        professional: {
          monthly: '£36',
          annual: '£339',
        },
      },
      SEK: {
        symbol: 'kr',
        student: {
          monthly: '72 kr',
          annual: '719 kr',
        },
        personal: {
          monthly: '111 kr',
          annual: '1049 kr',
        },
        collaborator: {
          monthly: '169 kr',
          annual: '1599 kr',
        },
        professional: {
          monthly: '339 kr',
          annual: '3169 kr',
        },
      },
      CAD: {
        symbol: '$',
        student: {
          monthly: '$11',
          annual: '$109',
        },
        personal: {
          monthly: '$17',
          annual: '$159',
        },
        collaborator: {
          monthly: '$27',
          annual: '$249',
        },
        professional: {
          monthly: '$52',
          annual: '$499',
        },
      },
      NOK: {
        symbol: 'kr',
        student: {
          monthly: '72 kr',
          annual: '719 kr',
        },
        personal: {
          monthly: '111 kr',
          annual: '1049 kr',
        },
        collaborator: {
          monthly: '169 kr',
          annual: '1599 kr',
        },
        professional: {
          monthly: '339 kr',
          annual: '3169 kr',
        },
      },
      DKK: {
        symbol: 'kr',
        student: {
          monthly: '60 kr',
          annual: '599 kr',
        },
        personal: {
          monthly: '90 kr',
          annual: '859 kr',
        },
        collaborator: {
          monthly: '139 kr',
          annual: '1299 kr',
        },
        professional: {
          monthly: '270 kr',
          annual: '2589 kr',
        },
      },
      AUD: {
        symbol: '$',
        student: {
          monthly: '$12',
          annual: '$119',
        },
        personal: {
          monthly: '$18',
          annual: '$169',
        },
        collaborator: {
          monthly: '$28',
          annual: '$259',
        },
        professional: {
          monthly: '$53',
          annual: '$499',
        },
      },
      NZD: {
        symbol: '$',
        student: {
          monthly: '$12',
          annual: '$119',
        },
        personal: {
          monthly: '$18',
          annual: '$169',
        },
        collaborator: {
          monthly: '$28',
          annual: '$259',
        },
        professional: {
          monthly: '$53',
          annual: '$499',
        },
      },
      CHF: {
        symbol: 'Fr',
        student: {
          monthly: 'Fr 10',
          annual: 'Fr 99',
        },
        personal: {
          monthly: 'Fr 16',
          annual: 'Fr 149',
        },
        collaborator: {
          monthly: 'Fr 23',
          annual: 'Fr 219',
        },
        professional: {
          monthly: 'Fr 46',
          annual: 'Fr 439',
        },
      },
      SGD: {
        symbol: '$',
        student: {
          monthly: '$14',
          annual: '$139',
        },
        personal: {
          monthly: '$20',
          annual: '$189',
        },
        collaborator: {
          monthly: '$30',
          annual: '$279',
        },
        professional: {
          monthly: '$60',
          annual: '$569',
        },
      },
    },
  }
})
