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
          monthly: '$9',
          annual: '$89',
        },
        personal: {
          monthly: '$14',
          annual: '$129',
        },
        collaborator: {
          monthly: '$21',
          annual: '$199',
        },
        professional: {
          monthly: '$42',
          annual: '$399',
        },
      },
      EUR: {
        symbol: '€',
        student: {
          monthly: '€8',
          annual: '€79',
        },
        personal: {
          monthly: '€13',
          annual: '€119',
        },
        collaborator: {
          monthly: '€19',
          annual: '€179',
        },
        professional: {
          monthly: '€39',
          annual: '€369',
        },
      },
      GBP: {
        symbol: '£',
        student: {
          monthly: '£7',
          annual: '£69',
        },
        personal: {
          monthly: '£11',
          annual: '£104',
        },
        collaborator: {
          monthly: '£17',
          annual: '£159',
        },
        professional: {
          monthly: '£34',
          annual: '£319',
        },
      },
      SEK: {
        symbol: 'kr',
        student: {
          monthly: '66 kr',
          annual: '659 kr',
        },
        personal: {
          monthly: '104 kr',
          annual: '969 kr',
        },
        collaborator: {
          monthly: '154 kr',
          annual: '1449 kr',
        },
        professional: {
          monthly: '299 kr',
          annual: '2869 kr',
        },
      },
      CAD: {
        symbol: '$',
        student: {
          monthly: '$10',
          annual: '$99',
        },
        personal: {
          monthly: '$16',
          annual: '$149',
        },
        collaborator: {
          monthly: '$25',
          annual: '$229',
        },
        professional: {
          monthly: '$48',
          annual: '$449',
        },
      },
      NOK: {
        symbol: 'kr',
        student: {
          monthly: '66 kr',
          annual: '659 kr',
        },
        personal: {
          monthly: '104 kr',
          annual: '969 kr',
        },
        collaborator: {
          monthly: '154 kr',
          annual: '1449 kr',
        },
        professional: {
          monthly: '299 kr',
          annual: '2869 kr',
        },
      },
      DKK: {
        symbol: 'kr',
        student: {
          monthly: '55 kr',
          annual: '549 kr',
        },
        personal: {
          monthly: '84 kr',
          annual: '799 kr',
        },
        collaborator: {
          monthly: '129 kr',
          annual: '1199 kr',
        },
        professional: {
          monthly: '249 kr',
          annual: '2379 kr',
        },
      },
      AUD: {
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
          monthly: '$25',
          annual: '$239',
        },
        professional: {
          monthly: '$49',
          annual: '$459',
        },
      },
      NZD: {
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
          monthly: '$25',
          annual: '$239',
        },
        professional: {
          monthly: '$49',
          annual: '$459',
        },
      },
      CHF: {
        symbol: 'Fr',
        student: {
          monthly: 'Fr 9',
          annual: 'Fr 89',
        },
        personal: {
          monthly: 'Fr 14',
          annual: 'Fr 134',
        },
        collaborator: {
          monthly: 'Fr 21',
          annual: 'Fr 199',
        },
        professional: {
          monthly: 'Fr 42',
          annual: 'Fr 399',
        },
      },
      SGD: {
        symbol: '$',
        student: {
          monthly: '$13',
          annual: '$129',
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
          monthly: '$55',
          annual: '$519',
        },
      },
      INR: {
        symbol: '₹',
        student: {
          monthly: '₹219',
          annual: '₹2199',
        },
        personal: {
          monthly: '₹339',
          annual: '₹2999',
        },
        collaborator: {
          monthly: '₹499',
          annual: '₹4599',
        },
        professional: {
          monthly: '₹999',
          annual: '₹9599',
        },
      },
      BRL: {
        symbol: 'R$',
        student: {
          monthly: 'R$ 23',
          annual: 'R$ 229',
        },
        personal: {
          monthly: 'R$ 35',
          annual: 'R$ 329',
        },
        collaborator: {
          monthly: 'R$ 55',
          annual: 'R$ 499',
        },
        professional: {
          monthly: 'R$ 109',
          annual: 'R$ 999',
        },
      },
      MXN: {
        symbol: '$',
        student: {
          monthly: '$99',
          annual: '$999',
        },
        personal: {
          monthly: '$149',
          annual: '$1,399',
        },
        collaborator: {
          monthly: '$229',
          annual: '$2,199',
        },
        professional: {
          monthly: '$459',
          annual: '$4,399',
        },
      },
      COP: {
        symbol: '$',
        student: {
          monthly: '$ 12.900',
          annual: '$ 129.900',
        },
        personal: {
          monthly: '$ 21.900',
          annual: '$ 185.900',
        },
        collaborator: {
          monthly: '$ 29.900',
          annual: '$ 285.900',
        },
        professional: {
          monthly: '$ 59.900',
          annual: '$ 575.900',
        },
      },
      CLP: {
        symbol: '$',
        student: {
          monthly: '$3.990',
          annual: '$38.990',
        },
        personal: {
          monthly: '$6.190',
          annual: '$56.990',
        },
        collaborator: {
          monthly: '$9.190',
          annual: '$87.990',
        },
        professional: {
          monthly: '$18.990',
          annual: '$174.990',
        },
      },
      PEN: {
        symbol: 'S/',
        student: {
          monthly: 'S/ 16',
          annual: 'S/ 159',
        },
        personal: {
          monthly: 'S/ 26',
          annual: 'S/ 239',
        },
        collaborator: {
          monthly: 'S/ 39',
          annual: 'S/ 369',
        },
        professional: {
          monthly: 'S/ 76',
          annual: 'S/ 729',
        },
      },
    },
  }
})
