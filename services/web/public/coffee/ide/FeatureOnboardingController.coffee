define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, settings) ->
		$scope.isFeatureSettingDefined = window.userSettings.syntaxValidation?;

		$scope.innerStep = 1

		$scope.turnCodeCheckOn = () ->
			settings.saveSettings({ syntaxValidation: true })
			navToInnerStep2()
			
		$scope.turnCodeCheckOn = () ->
			settings.saveSettings({ syntaxValidation: false })
			navToInnerStep2()

		$scope.dismiss = () ->
			$scope.isFeatureSettingDefined = true 

		navToInnerStep2 = () ->
			$scope.innerStep = 2
			$scope.ui.leftMenuShown = true
