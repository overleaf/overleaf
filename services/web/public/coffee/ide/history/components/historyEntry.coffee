define [
	"base"
	"ide/colors/ColorManager"
	"ide/history/util/displayNameForUser"
], (App, ColorManager, displayNameForUser) ->
	historyEntryController = ($scope, $element, $attrs, _) ->
		ctrl = @
		# This method (and maybe the one below) will be removed soon. User details data will be 
		# injected into the history API responses, so we won't need to fetch user data from other
		# local data structures.
		_getUserById = (id) ->
			_.find ctrl.users, (user) ->
				curUserId = user?._id or user?.id
				curUserId == id
		ctrl.displayName = displayNameForUser
		ctrl.displayNameById = (id) ->
			displayNameForUser(_getUserById(id))
		ctrl.getProjectOpDoc = (projectOp) ->
			if projectOp.rename? then "#{ projectOp.rename.pathname} → #{ projectOp.rename.newPathname }"
			else if projectOp.add? then "#{ projectOp.add.pathname}"
			else if projectOp.remove? then "#{ projectOp.remove.pathname}"
		ctrl.getUserCSSStyle = (user) ->
			curUserId = user?._id or user?.id
			hue = ColorManager.getHueForUserId(curUserId) or 100
			if ctrl.entry.inSelection 
				color : "#FFF" 
			else 
				color: "hsl(#{ hue }, 70%, 50%)"
		return

	App.component "historyEntry", {
		bindings:
			entry: "<"
			currentUser: "<"
			users: "<"
			onSelect: "&"
			onLabelDelete: "&"
		controller: historyEntryController
		templateUrl: "historyEntryTpl"
	}