define [
	"base"
], (App) ->

	App.controller 'LeftHandMenuPromoController', ($scope, UserAffiliationsDataService) ->

		$scope.hasProjects = window.data.projects.length > 0
		$scope.userHasNoSubscription = window.userHasNoSubscription

		_userHasNoAffiliation = () ->
			$scope.userEmails = []
			$scope.userAffiliations = []
			UserAffiliationsDataService.getUserEmails().then (emails) ->
				$scope.userEmails = emails
				for email in emails
					if email.affiliation
						$scope.userAffiliations.push email.affiliation

		_userHasNoAffiliation()
