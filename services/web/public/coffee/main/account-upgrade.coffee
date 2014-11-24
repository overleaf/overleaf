define [
	"base"
], (App) ->
	App.controller "FreeTrialModalController", ($scope, abTestManager)->

		buttonColorBuckets = [
			{ bucketName:"red", btnClass:"primary"}
			{ bucketName:"blue", btnClass:"info"}
		]

		buttonColorBucket = abTestManager.getABTestBucket "button_color", buttonColorBuckets
		abTestManager.processTestWithStep("button_color", buttonColorBucket.bucketName, 0)
		$scope.buttonClass = "btn-#{buttonColorBucket.btnClass}"


		$scope.startFreeTrial = (source) ->

			testBuckets = [
				{ bucketName:"student_control", planName:"student"}
				{ bucketName:"collab_test", planName:"collaborator"}
			]

			editorPlanBucket = abTestManager.getABTestBucket "editor_plan", testBuckets
			abTestManager.processTestWithStep("editor_plan", editorPlanBucket.bucketName, 0)
			ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
			window.open("/user/subscription/new?planCode=#{editorPlanBucket.planName}_free_trial_7_days&ssp=#{editorPlanBucket.planName == 'collaborator'}")
			$scope.startedFreeTrial = true