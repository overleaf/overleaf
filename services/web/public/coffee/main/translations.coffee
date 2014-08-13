define [
	"base"
], (App) ->
	App.controller "TranslationsPopupController", ($scope, ipCookie) ->

		$scope.hidei18nNotification = ipCookie("hidei18nNotification")

		$scope.dismiss = ->
			ipCookie("hidei18nNotification", true, {expires:180})
			$scope.hidei18nNotification = ipCookie("hidei18nNotification")
