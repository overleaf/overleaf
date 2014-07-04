define [
	"base"
], (App) ->
	App.controller "BinaryFileController", ["$scope", ($scope) ->
		$scope.extension = (file) ->
			return file.name.split(".").pop()?.toLowerCase()
	]