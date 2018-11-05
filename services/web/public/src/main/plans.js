/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'libs/recurly-4.8.5'], function(App, recurly) {
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

  return App.controller('PlansController', function(
    $scope,
    $modal,
    event_tracking,
    MultiCurrencyPricing,
    $http,
    $filter,
    ipCookie
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
      return ($scope.currencyCode = newCurrency)
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
      return event_tracking.send(
        'subscription-funnel',
        'sign_up_now_button',
        plan
      )
    }

    $scope.switchToMonthly = function(e, location) {
      const uiView = 'monthly'
      switchEvent(e, uiView + '-prices', location)
      return ($scope.ui.view = uiView)
    }

    $scope.switchToStudent = function(e, location) {
      const uiView = 'student'
      switchEvent(e, uiView + '-prices', location)
      return ($scope.ui.view = uiView)
    }

    $scope.switchToAnnual = function(e, location) {
      const uiView = 'annual'
      switchEvent(e, uiView + '-prices', location)
      return ($scope.ui.view = uiView)
    }

    $scope.openGroupPlanModal = function() {
      $modal.open({
        templateUrl: 'groupPlanModalTemplate'
      })
      return event_tracking.send(
        'subscription-funnel',
        'plans-page',
        'group-inquiry-potential'
      )
    }

    var eventLabel = (label, location) => label

    return (switchEvent = function(e, label, location) {
      e.preventDefault()
      const gaLabel = eventLabel(label, location)
      return event_tracking.send('subscription-funnel', 'plans-page', gaLabel)
    })
  })
})
