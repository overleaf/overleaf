define [
	"base"
], (App) ->

	App.controller 'ScribtexPopupController', ($scope, $modal) ->

		$modal.open {
			templateUrl: "scribtexModalTemplate"
		}
