define [
	"base"
], (App) ->
	App.controller "TranslationsPopupController", ($scope, $cookies) ->

		$scope.hidei18nNotification = $cookies.hidei18nNotification

		$scope.dismiss = ->
			$cookies.hidei18nNotification = true
			$scope.hidei18nNotification = $cookies.hidei18nNotification
