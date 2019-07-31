/* eslint-disable
    camelcase,
    max-len
*/
/* global define,history */
define(['base'], function(App) {
  App.factory('MultiCurrencyPricing', function() {
    const currencyCode = window.recomendedCurrency

    return {
      currencyCode,

      plans: {
        USD: {
          symbol: '$',
          student: {
            monthly: '$8',
            annual: '$80'
          },
          collaborator: {
            monthly: '$15',
            annual: '$180'
          },
          professional: {
            monthly: '$30',
            annual: '$360'
          }
        },

        EUR: {
          symbol: '€',
          student: {
            monthly: '€7',
            annual: '€70'
          },
          collaborator: {
            monthly: '€14',
            annual: '€168'
          },
          professional: {
            monthly: '€28',
            annual: '€336'
          }
        },

        GBP: {
          symbol: '£',
          student: {
            monthly: '£6',
            annual: '£60'
          },
          collaborator: {
            monthly: '£12',
            annual: '£144'
          },
          professional: {
            monthly: '£24',
            annual: '£288'
          }
        },

        SEK: {
          symbol: 'kr',
          student: {
            monthly: '60 kr',
            annual: '600 kr'
          },
          collaborator: {
            monthly: '110 kr',
            annual: '1320 kr'
          },
          professional: {
            monthly: '220 kr',
            annual: '2640 kr'
          }
        },
        CAD: {
          symbol: '$',
          student: {
            monthly: '$9',
            annual: '$90'
          },
          collaborator: {
            monthly: '$17',
            annual: '$204'
          },
          professional: {
            monthly: '$34',
            annual: '$408'
          }
        },

        NOK: {
          symbol: 'kr',
          student: {
            monthly: '60 kr',
            annual: '600 kr'
          },
          collaborator: {
            monthly: '110 kr',
            annual: '1320 kr'
          },
          professional: {
            monthly: '220 kr',
            annual: '2640 kr'
          }
        },

        DKK: {
          symbol: 'kr',
          student: {
            monthly: '50 kr',
            annual: '500 kr'
          },
          collaborator: {
            monthly: '90 kr',
            annual: '1080 kr'
          },
          professional: {
            monthly: '180 kr',
            annual: '2160 kr'
          }
        },

        AUD: {
          symbol: '$',
          student: {
            monthly: '$10',
            annual: '$100'
          },
          collaborator: {
            monthly: '$18',
            annual: '$216'
          },
          professional: {
            monthly: '$35',
            annual: '$420'
          }
        },

        NZD: {
          symbol: '$',
          student: {
            monthly: '$10',
            annual: '$100'
          },
          collaborator: {
            monthly: '$18',
            annual: '$216'
          },
          professional: {
            monthly: '$35',
            annual: '$420'
          }
        },

        CHF: {
          symbol: 'Fr',
          student: {
            monthly: 'Fr 8',
            annual: 'Fr 80'
          },
          collaborator: {
            monthly: 'Fr 15',
            annual: 'Fr 180'
          },
          professional: {
            monthly: 'Fr 30',
            annual: 'Fr 360'
          }
        },

        SGD: {
          symbol: '$',
          student: {
            monthly: '$12',
            annual: '$120'
          },
          collaborator: {
            monthly: '$20',
            annual: '$240'
          },
          professional: {
            monthly: '$40',
            annual: '$480'
          }
        }
      }
    }
  })

  App.controller('PlansController', function(
    $scope,
    $modal,
    event_tracking,
    MultiCurrencyPricing,
    $http,
    $filter,
    ipCookie,
    $location
  ) {
    let switchEvent
    $scope.showPlans = true

    $scope.plans = MultiCurrencyPricing.plans

    $scope.currencyCode = MultiCurrencyPricing.currencyCode

    $scope.trial_len = 7

    $scope.planQueryString = '_free_trial_7_days'

    $scope.ui = { view: 'monthly' }

    $scope.changeCurreny = function(e, newCurrency) {
      e.preventDefault()
      $scope.currencyCode = newCurrency
    }

    // because ternary logic in angular bindings is hard
    $scope.getCollaboratorPlanCode = function() {
      const { view } = $scope.ui
      if (view === 'annual') {
        return 'collaborator-annual'
      } else {
        return `collaborator${$scope.planQueryString}`
      }
    }

    $scope.signUpNowClicked = function(plan, location) {
      if ($scope.ui.view === 'annual') {
        plan = `${plan}_annual`
      }
      plan = eventLabel(plan, location)
      event_tracking.sendMB('plans-page-start-trial')
      event_tracking.send('subscription-funnel', 'sign_up_now_button', plan)
    }

    $scope.switchToMonthly = function(e, location) {
      const uiView = 'monthly'
      switchEvent(e, uiView + '-prices', location)
      $scope.ui.view = uiView
    }

    $scope.switchToStudent = function(e, location) {
      const uiView = 'student'
      switchEvent(e, uiView + '-prices', location)
      $scope.ui.view = uiView
    }

    $scope.switchToAnnual = function(e, location) {
      const uiView = 'annual'
      switchEvent(e, uiView + '-prices', location)
      $scope.ui.view = uiView
    }

    $scope.openGroupPlanModal = function() {
      const path = `${window.location.pathname}${window.location.search}`
      history.replaceState(null, document.title, path + '#groups')
      $modal
        .open({
          templateUrl: 'groupPlanModalPurchaseTemplate',
          controller: 'GroupPlansModalPurchaseController'
        })
        .result.finally(() =>
          history.replaceState(null, document.title, window.location.pathname)
        )
      event_tracking.send(
        'subscription-funnel',
        'plans-page',
        'group-inquiry-potential'
      )
    }
    if ($location.hash() === 'groups') {
      $scope.openGroupPlanModal()
    }

    var eventLabel = (label, location) => label

    switchEvent = function(e, label, location) {
      e.preventDefault()
      const gaLabel = eventLabel(label, location)
      event_tracking.send('subscription-funnel', 'plans-page', gaLabel)
    }
  })

  App.controller('GroupPlansModalPurchaseController', function(
    $scope,
    $modal,
    $location
  ) {
    $scope.options = {
      plan_codes: [
        {
          display: 'Collaborator',
          code: 'collaborator'
        },
        {
          display: 'Professional',
          code: 'professional'
        }
      ],
      currencies: [
        {
          display: 'USD ($)',
          code: 'USD'
        },
        {
          display: 'GBP (£)',
          code: 'GBP'
        },
        {
          display: 'EUR (€)',
          code: 'EUR'
        }
      ],
      currencySymbols: {
        USD: '$',
        EUR: '€',
        GBP: '£'
      },
      sizes: [2, 3, 4, 5, 10, 20, 50],
      usages: [
        {
          display: 'Enterprise',
          code: 'enterprise'
        },
        {
          display: 'Educational',
          code: 'educational'
        }
      ]
    }

    $scope.prices = window.groupPlans

    let currency = 'USD'
    if (['USD', 'GBP', 'EUR'].includes(window.recomendedCurrency)) {
      currency = window.recomendedCurrency
    }

    // default selected
    $scope.selected = {
      plan_code: 'collaborator',
      currency,
      size: '10',
      usage: 'educational'
    }
    // selected via query
    if ($location.search()) {
      // usage
      if ($location.search().usage) {
        $scope.options.usages.forEach(usage => {
          if (usage.code === $location.search().usage) {
            $scope.selected.usage = usage.code
          }
        })
      }
      // plan
      if ($location.search().plan) {
        $scope.options.plan_codes.forEach(plan => {
          if (plan.code === $location.search().plan) {
            $scope.selected.plan_code = plan.code
          }
        })
      }
      // number
      if ($location.search().number) {
        // $location.search().number is a string,
        // but $scope.options.sizes are numbers
        // and $scope.selected.size is a string
        const groupCount = parseInt($location.search().number, 10)
        if ($scope.options.sizes.indexOf(groupCount) !== -1) {
          $scope.selected.size = $location.search().number
        }
      }
      // currency
      if ($location.search().currency) {
        $scope.options.currencies.forEach(currency => {
          if (currency.code === $location.search().currency) {
            $scope.selected.currency = currency.code
          }
        })
      }
    }

    $scope.recalculatePrice = function() {
      let { usage, plan_code, currency, size } = $scope.selected
      const price = $scope.prices[usage][plan_code][currency][size]
      const currencySymbol = $scope.options.currencySymbols[currency]
      $scope.displayPrice = `${currencySymbol}${price}`
    }

    $scope.$watch('selected', $scope.recalculatePrice, true)
    $scope.recalculatePrice()

    $scope.purchase = function() {
      let { plan_code, size, usage, currency } = $scope.selected
      plan_code = `group_${plan_code}_${size}_${usage}`
      window.location = `/user/subscription/new?planCode=${plan_code}&currency=${currency}`
    }

    $scope.payByInvoice = function() {
      $modal.open({
        templateUrl: 'groupPlanModalInquiryTemplate'
      })
      $scope.$close()
    }
  })
})
