define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager, sixpack, event_tracking)->

		$scope.buttonClass = "btn-primary"

		$scope.startFreeTrial = (source, couponCode) ->
			plan = 'collaborator_free_trial_7_days'

			w = window.open()
			go = () ->
				ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
				url = "/user/subscription/new?planCode=#{plan}&ssp=true"
				if couponCode?
					url = "#{url}&cc=#{couponCode}"
				$scope.startedFreeTrial = true

				switch source
					when "dropbox"
						sixpack.participate 'teaser-dropbox-text', ['default', 'dropbox-focused'], (variant) ->
							event_tracking.sendMB "subscription-start-trial", { source, plan, variant }

					when "history"
						sixpack.participate 'teaser-history', ['default', 'focused'], (variant) ->
							event_tracking.sendMB "subscription-start-trial", { source, plan, variant }

					else
						event_tracking.sendMB "subscription-start-trial", { source, plan }
				
				w.location = url

			if $scope.shouldABTestPlans
				sixpack.participate 'plans-1610', ['default', 'heron', 'ibis'], (chosenVariation, rawResponse)->
					if chosenVariation in ['heron', 'ibis']
						plan = "collaborator_#{chosenVariation}"
					go()
			else
				go()
