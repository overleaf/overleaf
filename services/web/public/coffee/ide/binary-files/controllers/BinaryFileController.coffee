define [
	"base"
], (App) ->
	App.controller "BinaryFileController", ["$scope", ($scope) ->

		$scope.failedLoad = false

		window.sl_binaryFilePreviewError = () =>
			$scope.failedLoad = true
			$scope.$apply()

		$scope.extension = (file) ->
			return file.name.split(".").pop()?.toLowerCase()
	]
