define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager, sixpack, event_tracking)->

		$scope.buttonClass = "btn-primary"

		$scope.startFreeTrial = (source, couponCode) ->
			plan = 'collaborator_free_trial_7_days'

			w = window.open()
			sixpack.participate 'plans-1610', ['default', 'heron', 'ibis'], (chosenVariation, rawResponse)->
				if $scope.shouldABTestPlans and chosenVariation in ['heron', 'ibis']
					plan = "collaborator_#{chosenVariation}"

				ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
				url = "/user/subscription/new?planCode=#{plan}&ssp=true"
				if couponCode?
					url = "#{url}&cc=#{couponCode}"

				$scope.startedFreeTrial = true
				event_tracking.sendMB "subscription-start-trial", { source, plan}
				w.location = url
