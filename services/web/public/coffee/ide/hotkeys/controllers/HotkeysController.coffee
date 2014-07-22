define [
	"base"
	"ace/ace"
], (App) ->
	App.controller "HotkeysController", ($scope, $modal) ->
		$scope.openHotkeysModal = ->
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