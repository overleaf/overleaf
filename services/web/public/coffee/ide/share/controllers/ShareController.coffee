define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "ide", "projectInvites", "projectMembers", "event_tracking",
	($scope, $modal, ide, projectInvites, projectMembers, event_tracking) ->
			$scope.openShareProjectModal = (isAdmin) ->
				$scope.isAdmin = isAdmin;
				event_tracking.sendMBOnce "ide-open-share-modal-once"

				$modal.open(
					templateUrl: "shareProjectModalTemplate"
					controller:  "ShareProjectModalController"
					scope: $scope
				)

			ide.socket.on 'project:tokens:changed', (data) =>
				if data.tokens?
					ide.$scope.project.tokens = data.tokens
					$scope.$digest()

			ide.socket.on 'project:membership:changed', (data) =>
				if data.members
					projectMembers.getMembers()
						.then (response) =>
							{ data } = response
							if data.members
								$scope.project.members = data.members
						.catch () =>
							console.error "Error fetching members for project"
				if data.invites
					projectInvites.getInvites()
						.then (response) =>
							{ data } = response
							if data.invites
								$scope.project.invites = data.invites
						.catch () =>
							console.error "Error fetching invites for project"
	]
