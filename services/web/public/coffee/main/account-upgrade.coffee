define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager, sixpack, event_tracking)->

		$scope.buttonClass = "btn-primary"

		$scope.startFreeTrial = (source, couponCode) ->
			event_tracking.sendMB "subscription-start-trial", { source, plan: $scope.startTrialPlanCode }

			w = window.open()
			sixpack.convert "track-changes-discount", ->
				ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
				url = "/user/subscription/new?planCode=#{$scope.startTrialPlanCode}&ssp=true"
				if couponCode?
					url = "#{url}&cc=#{couponCode}"
				$scope.startedFreeTrial = true
				w.location = url
