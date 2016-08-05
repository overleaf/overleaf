define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "ide", "projectInvites", "projectMembers", "event_tracking",
	($scope, $modal, ide, projectInvites, projectMembers, event_tracking) ->
			$scope.openShareProjectModal = () ->
				event_tracking.sendCountlyOnce "ide-open-share-modal-once"

				$modal.open(
					templateUrl: "shareProjectModalTemplate"
					controller:  "ShareProjectModalController"
					scope: $scope
				)

			ide.socket.on 'project:membership:changed', (data) =>
				if data.members
					projectMembers.getMembers().success (responseData) =>
						if responseData.members
							$scope.project.members = responseData.members
				if data.invites
					projectInvites.getInvites().success (responseData) =>
						if responseData.invites
							$scope.project.invites = responseData.invites
	]
