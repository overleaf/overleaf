define [
	"base"
], (App) ->

	App.controller 'LeftHandMenuPromoController', ($scope) ->

		$scope.hasProjects = window.data.projects.length > 0
		$scope.userHasSubscription = window.userHasSubscription
		$scope.randomView = _.shuffle(["default", "dropbox", "github"])[0]
