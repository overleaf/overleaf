/* eslint-disable
    camelcase,
    max-len
*/
import App from '../base'
import getMeta from '../utils/meta'
App.factory('MultiCurrencyPricing', function () {
  const currencyCode = getMeta('ol-recomendedCurrency')

  return {
    currencyCode,

    plans: {
      USD: {
        symbol: '$',
        student: {
          monthly: '$8',
          annual: '$80',
        },
        personal: {
          monthly: '$5',
          annual: '$49',
        },
        collaborator: {
          monthly: '$19',
          annual: '$180',
        },
        professional: {
          monthly: '$38',
          annual: '$360',
        },
      },

      EUR: {
        symbol: '€',
        student: {
          monthly: '€7',
          annual: '€70',
        },
        personal: {
          monthly: '€5',
          annual: '€44',
        },
        collaborator: {
          monthly: '€18',
          annual: '€168',
        },
        professional: {
          monthly: '€35',
          annual: '€336',
        },
      },

      GBP: {
        symbol: '£',
        student: {
          monthly: '£6',
          annual: '£60',
        },
        personal: {
          monthly: '£4',
          annual: '£39',
        },
        collaborator: {
          monthly: '£15',
          annual: '£144',
        },
        professional: {
          monthly: '£30',
          annual: '£288',
        },
      },

      SEK: {
        symbol: 'kr',
        student: {
          monthly: '60 kr',
          annual: '600 kr',
        },
        personal: {
          monthly: '35 kr',
          annual: '359 kr',
        },
        collaborator: {
          monthly: '138 kr',
          annual: '1320 kr',
        },
        professional: {
          monthly: '275 kr',
          annual: '2640 kr',
        },
      },
      CAD: {
        symbol: '$',
        student: {
          monthly: '$9',
          annual: '$90',
        },
        personal: {
          monthly: '$5',
          annual: '$55',
        },
        collaborator: {
          monthly: '$22',
          annual: '$204',
        },
        professional: {
          monthly: '$43',
          annual: '$408',
        },
      },

      NOK: {
        symbol: 'kr',
        student: {
          monthly: '60 kr',
          annual: '600 kr',
        },
        personal: {
          monthly: '35 kr',
          annual: '359 kr',
        },
        collaborator: {
          monthly: '138 kr',
          annual: '1320 kr',
        },
        professional: {
          monthly: '275 kr',
          annual: '2640 kr',
        },
      },

      DKK: {
        symbol: 'kr',
        student: {
          monthly: '50 kr',
          annual: '500 kr',
        },
        personal: {
          monthly: '29 kr',
          annual: '295 kr',
        },
        collaborator: {
          monthly: '113 kr',
          annual: '1080 kr',
        },
        professional: {
          monthly: '225 kr',
          annual: '2160 kr',
        },
      },

      AUD: {
        symbol: '$',
        student: {
          monthly: '$10',
          annual: '$100',
        },
        personal: {
          monthly: '$6',
          annual: '$59',
        },
        collaborator: {
          monthly: '$23',
          annual: '$216',
        },
        professional: {
          monthly: '$44',
          annual: '$420',
        },
      },

      NZD: {
        symbol: '$',
        student: {
          monthly: '$10',
          annual: '$100',
        },
        personal: {
          monthly: '$6',
          annual: '$59',
        },
        collaborator: {
          monthly: '$23',
          annual: '$216',
        },
        professional: {
          monthly: '$44',
          annual: '$420',
        },
      },

      CHF: {
        symbol: 'Fr',
        student: {
          monthly: 'Fr 8',
          annual: 'Fr 80',
        },
        personal: {
          monthly: 'Fr 5',
          annual: 'Fr 49',
        },
        collaborator: {
          monthly: 'Fr 19',
          annual: 'Fr 180',
        },
        professional: {
          monthly: 'Fr 38',
          annual: 'Fr 360',
        },
      },

      SGD: {
        symbol: '$',
        student: {
          monthly: '$12',
          annual: '$120',
        },
        personal: {
          monthly: '$7',
          annual: '$64',
        },
        collaborator: {
          monthly: '$25',
          annual: '$240',
        },
        professional: {
          monthly: '$50',
          annual: '$480',
        },
      },
    },
  }
})
