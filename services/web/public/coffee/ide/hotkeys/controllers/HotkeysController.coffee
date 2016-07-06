define [
	"base"
	"ace/ace"
], (App) ->
	App.controller "HotkeysController", ($scope, $modal, event_tracking) ->
		$scope.openHotkeysModal = ->
			event_tracking.sendCountly "ide-open-hotkeys-modal"

			$modal.open {
				templateUrl: "hotkeysModalTemplate"
				controller:  "HotkeysModalController"
			}
		
	App.controller "HotkeysModalController", ($scope, $modalInstance)->
		if ace.require("ace/lib/useragent").isMac
			$scope.ctrl = "Cmd"
		else
			$scope.ctrl = "Ctrl"
		
		$scope.cancel = () ->
			$modalInstance.dismiss()