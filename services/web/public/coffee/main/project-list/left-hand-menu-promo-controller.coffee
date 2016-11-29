define [
	"base"
], (App) ->

	App.controller 'LeftHandMenuPromoController', ($scope) ->

		$scope.hasProjects = window.data.projects.length > 0
		$scope.userHasNoSubscription = window.userHasNoSubscription

		$scope.showCaseStudy = window.data.caseStudy?.url?
		$scope.caseStudy = window.data.caseStudy

