define [
	"base"
], (App) ->
	App.controller 'WordCountController', ($scope, $modal) ->
		$scope.openWordCountModal = () ->
			$modal.open {
				templateUrl: "wordCountModalTemplate"
				controller:  "WordCountModalController"
			}