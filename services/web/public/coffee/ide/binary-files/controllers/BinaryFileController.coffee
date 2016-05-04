define [
	"base"
], (App) ->
	App.controller "BinaryFileController", ["$scope", "$rootScope", ($scope, $rootScope) ->

		$scope.failedLoad = false
		$rootScope.$on 'entity:selected', () ->
			$scope.failedLoad = false

		window.sl_binaryFilePreviewError = () =>
			$scope.failedLoad = true
			$scope.$apply()

		$scope.extension = (file) ->
			return file.name.split(".").pop()?.toLowerCase()
	]
