define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "ide", "projectInvites", "projectMembers", "event_tracking",
	($scope, $modal, ide, projectInvites, projectMembers, event_tracking) ->
			$scope.openShareProjectModal = () ->
				event_tracking.sendMBOnce "ide-open-share-modal-once"

				$modal.open(
					templateUrl: "shareProjectModalTemplate"
					controller:  "ShareProjectModalController"
					scope: $scope
				)

			ide.socket.on 'project:membership:changed', (data) =>
				if data.members
					projectMembers.getMembers()
						.then (responseData) =>
							if responseData.members
								$scope.project.members = responseData.members
						.catch (responseDate) =>
							console.error "Error fetching members for project"
				if data.invites
					projectInvites.getInvites()
						.then (responseData) =>
							if responseData.invites
								$scope.project.invites = responseData.invites
						.catch (responseDate) =>
							console.error "Error fetching invites for project"
	]
