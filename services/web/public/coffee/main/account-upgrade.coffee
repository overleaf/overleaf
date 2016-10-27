define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager, sixpack, event_tracking)->

		$scope.buttonClass = "btn-primary"

		$scope.startFreeTrial = (source, couponCode) ->
			w = window.open()

			switch source
				when "dropbox"
					sixpack.participate 'teaser-dropbox-text', ['default', 'dropbox-focused'], (variant) ->
						event_tracking.sendMB "subscription-start-trial", { source, variant }

				when "history"
					sixpack.participate 'teaser-history', ['default', 'focused'], (variant) ->
						event_tracking.sendMB "subscription-start-trial", { source, variant }

				else
					event_tracking.sendMB "subscription-start-trial", { source }

			sixpack.convert "track-changes-discount", ->
				sixpack.participate 'in-editor-free-trial-plan', ['student', 'collaborator'], (planName, rawResponse)->
					ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
					url = "/user/subscription/new?planCode=#{planName}_free_trial_7_days&ssp=#{planName == 'collaborator'}"
					if couponCode?
						url = "#{url}&cc=#{couponCode}"
					$scope.startedFreeTrial = true
					w.location = url
