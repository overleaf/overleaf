define [
	"base"
	"libs/recurly-3.0.5"
], (App, recurly) ->


	App.factory "MultiCurrencyPricing", () ->

		currencyCode = window.recomendedCurrency

		return {
			currencyCode:currencyCode

			heron:
				USD:
					student:
						monthly: "$6"
						annual: "$60"
					collaborator:
						monthly: "$12"
						annual: "$144"
				EUR:
					student:
						monthly: "€5"
						annual: "€50"
					collaborator:
						monthly: "€10"
						annual: "€120"
				GBP:
					student:
						monthly: "£5"
						annual: "£50"
					collaborator:
						monthly: "£10"
						annual: "£120"
				SEK:
					student:
						monthly: "45 kr"
						annual: "450 kr"
					collaborator:
						monthly: "90 kr"
						annual: "1080 kr"
				CAD:
					student:
						monthly: "$7"
						annual: "$70"
					collaborator:
						monthly: "$14"
						annual: "$168"
				NOK:
					student:
						monthly: "45 kr"
						annual: "450 kr"
					collaborator:
						monthly: "90 kr"
						annual: "1080 kr"
				DKK:
					student:
						monthly: "40 kr"
						annual: "400 kr"
					collaborator:
						monthly: "80 kr"
						annual: "960 kr"
				AUD:
					student:
						monthly: "$8"
						annual: "$80"
					collaborator:
						monthly: "$16"
						annual: "$192"
				NZD:
					student:
						monthly: "$8"
						annual: "$80"
					collaborator:
						monthly: "$16"
						annual: "$192"
				CHF:
					student:
						monthly: "Fr 6"
						annual: "Fr 60"
					collaborator:
						monthly: "Fr 12"
						annual: "Fr 144"
				SGD:
					student:
						monthly: "$8"
						annual: "$80"
					collaborator:
						monthly: "$16"
						annual: "$192"

			ibis:
				USD:
					student:
						monthly: "$10"
						annual: "$100"
					collaborator:
						monthly: "$18"
						annual: "$216"
				EUR:
					student:
						monthly: "€9"
						annual: "€90"
					collaborator:
						monthly: "€16"
						annual: "€192"
				GBP:
					student:
						monthly: "£7"
						annual: "£70"
					collaborator:
						monthly: "£13"
						annual: "£156"
				SEK:
					student:
						monthly: "75 kr"
						annual: "750 kr"
					collaborator:
						monthly: "140 kr"
						annual: "1680 kr"
				CAD:
					student:
						monthly: "$12"
						annual: "$120"
					collaborator:
						monthly: "$22"
						annual: "$264"
				NOK:
					student:
						monthly: "75 kr"
						annual: "750 kr"
					collaborator:
						monthly: "140 kr"
						annual: "1680 kr"
				DKK:
					student:
						monthly: "68 kr"
						annual: "680 kr"
					collaborator:
						monthly: "122 kr"
						annual: "1464 kr"
				AUD:
					student:
						monthly: "$13"
						annual: "$130"
					collaborator:
						monthly: "$24"
						annual: "$288"
				NZD:
					student:
						monthly: "$14"
						annual: "$140"
					collaborator:
						monthly: "$25"
						annual: "$300"
				CHF:
					student:
						monthly: "Fr 10"
						annual: "Fr 100"
					collaborator:
						monthly: "Fr 18"
						annual: "Fr 216"
				SGD:
					student:
						monthly: "$14"
						annual: "$140"
					collaborator:
						monthly: "$25"
						annual: "$300"

			plans:
				USD:
					symbol: "$"
					student:
						monthly: "$8"
						annual: "$80"
					collaborator:
						monthly: "$15"
						annual: "$180"
					professional:
						monthly: "$30"
						annual: "$360"

				EUR:
					symbol: "€"
					student:
						monthly: "€7"
						annual: "€70"
					collaborator:
						monthly: "€14"
						annual: "€168"
					professional:
						monthly: "€28"
						annual: "€336"

				GBP:
					symbol: "£"
					student:
						monthly: "£6"
						annual: "£60"
					collaborator:
						monthly: "£12"
						annual: "£144"
					professional:
						monthly: "£24"
						annual: "£288"

				SEK:
					symbol: "kr"
					student:
						monthly: "60 kr"
						annual: "600 kr"
					collaborator:
						monthly: "110 kr"
						annual: "1320 kr"
					professional:
						monthly: "220 kr"
						annual: "2640 kr"
				CAD:
					symbol: "$"
					student:
						monthly: "$9"
						annual: "$90"
					collaborator:
						monthly: "$17"
						annual: "$204"
					professional:
						monthly: "$34"
						annual: "$408"

				NOK:
					symbol: "kr"
					student:
						monthly: "60 kr"
						annual: "600 kr"
					collaborator:
						monthly: "110 kr"
						annual: "1320 kr"
					professional:
						monthly: "220 kr"
						annual: "2640 kr"

				DKK:
					symbol: "kr"
					student:
						monthly: "50 kr"
						annual: "500 kr"
					collaborator:
						monthly: "90 kr"
						annual: "1080 kr"
					professional:
						monthly: "180 kr"
						annual: "2160 kr"

				AUD:
					symbol: "$"
					student:
						monthly: "$10"
						annual: "$100"
					collaborator:
						monthly: "$18"
						annual: "$216"
					professional:
						monthly: "$35"
						annual: "$420"

				NZD:
					symbol: "$"
					student:
						monthly: "$10"
						annual: "$100"
					collaborator:
						monthly: "$18"
						annual: "$216"
					professional:
						monthly: "$35"
						annual: "$420"

				CHF:
					symbol: "Fr"
					student:
						monthly: "Fr 8"
						annual: "Fr 80"
					collaborator:
						monthly: "Fr 15"
						annual: "Fr 180"
					professional:
						monthly: "Fr 30"
						annual: "Fr 360"

				SGD:
					symbol: "$"
					student:
						monthly: "$12"
						annual: "$120"
					collaborator:
						monthly: "$20"
						annual: "$240"
					professional:
						monthly: "$40"
						annual: "$480"

		}


	App.controller "PlansController", ($scope, $modal, event_tracking, abTestManager, MultiCurrencyPricing, $http, sixpack) ->

		$scope.plansVariant = 'default'
		$scope.shouldABTestPlans = window.shouldABTestPlans

		if $scope.shouldABTestPlans
			sixpack.participate 'plans-1610', ['default', 'heron', 'ibis'], (chosenVariation, rawResponse)->
				$scope.plansVariant = chosenVariation
				event_tracking.sendMB 'plans-page', {plans_variant: chosenVariation}
				if chosenVariation in ['heron', 'ibis']
					# overwrite student plans with alternative
					for currency, _v of $scope.plans
						$scope.plans[currency]['student'] = MultiCurrencyPricing[chosenVariation][currency]['student']
						$scope.plans[currency]['collaborator'] = MultiCurrencyPricing[chosenVariation][currency]['collaborator']

		$scope.plans = MultiCurrencyPricing.plans

		$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.trial_len = 7

		$scope.planQueryString = '_free_trial_7_days'

		$scope.ui =
			view: "monthly"

		$scope.changeCurreny = (newCurrency)->
			$scope.currencyCode = newCurrency

		$scope.signUpNowClicked = (plan, annual)->
			event_tracking.sendMB 'plans-page-start-trial', {plan}
			if $scope.shouldABTestPlans and plan in ['student', 'collaborator']
				sixpack.convert 'plans-1610', () ->
			if $scope.ui.view == "annual"
				plan = "#{plan}_annual"
			event_tracking.send   'subscription-funnel', 'sign_up_now_button', plan

		$scope.switchToMonthly = ->
			$scope.ui.view = "monthly"
			event_tracking.send 'subscription-funnel', 'plans-page', 'monthly-prices'

		$scope.switchToStudent = ->
			$scope.ui.view = "student"
			event_tracking.send 'subscription-funnel', 'plans-page', 'student-prices'

		$scope.switchToAnnual = ->
			$scope.ui.view = "annual"
			event_tracking.send 'subscription-funnel', 'plans-page', 'student-prices'

		$scope.openGroupPlanModal = () ->
			$modal.open {
				templateUrl: "groupPlanModalTemplate"
			}
