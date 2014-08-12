define [
	"base"
], (App) ->
	App.controller "PdfViewToggleController", ($scope) ->
		$scope.togglePdfView = () ->
			if $scope.ui.view == "pdf"
				$scope.ui.view = "editor"
			else
				$scope.ui.view = "pdf"
		
		$scope.fileTreeClosed = false		
		$scope.$on "layout:main:resize", (e, state) ->
			if state.west.initClosed
				$scope.fileTreeClosed = true
			else
				$scope.fileTreeClosed = false
			$scope.$apply()