define [
	"base"
], (App) ->

	App.controller 'LeftHandMenuPromoController', ($scope) ->
		
		$scope.showDatajoy = Math.random() < 0.5
		$scope.hasProjects = window.data.projects.length > 0
		$scope.userHasSubscription = window.userHasSubscription