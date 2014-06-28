define [
	"base"
], (App) ->
	App.controller "PdfController", ["$scope", ($scope) ->
		$scope.pdf =
			url: "/ScalaByExample.pdf"
	]