define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager, sixpack)->

		$scope.buttonClass = "btn-primary"

		$scope.startFreeTrial = (source, couponCode) ->
			sixpack.convert "track-changes-discount", ->

				sixpack.participate 'free-trial-plan', ['student', 'collaborator'], (planName, rawResponse)->
					ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
					url = "/user/subscription/new?planCode=#{planName}_free_trial_7_days&ssp=#{planName == 'collaborator'}"
					if couponCode?
						url = "#{url}&cc=#{couponCode}&scf=true"
					window.open(url)
					$scope.startedFreeTrial = true