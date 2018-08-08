define [
	"base"
	"ide/colors/ColorManager"
	"ide/history/util/displayNameForUser"
], (App, ColorManager, displayNameForUser) ->
	historyLabelsListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		# This method (and maybe the one below) will be removed soon. User details data will be 
		# injected into the history API responses, so we won't need to fetch user data from other
		# local data structures.
		ctrl.getUserById = (id) ->
			_.find ctrl.users, (user) ->
				curUserId = user?._id or user?.id
				curUserId == id
		ctrl.displayName = displayNameForUser
		ctrl.getUserCSSStyle = (user) ->
			curUserId = user?._id or user?.id
			hue = ColorManager.getHueForUserId(curUserId) or 100
			if false #ctrl.entry.inSelection 
				color : "#FFF" 
			else 
				color: "hsl(#{ hue }, 70%, 50%)"
		return

	App.component "historyLabelsList", {
		bindings:
			labels: "<"
			users: "<"
			currentUser: "<"
			isLoading: "<"
			onLabelSelect: "&"
			onLabelDelete: "&"
		controller: historyLabelsListController
		templateUrl: "historyLabelsListTpl"
	}
