define [], () ->
	return displayNameForUser = (user) ->
		if !user?
			return "Anonymous"
		if user.id == window.user.id
			return "you"
		if user.name?
			return user.name
		name = [user.first_name, user.last_name].filter((n) -> n?).join(" ").trim()
		if name == ""
			name = user.email.split("@")[0]
		if !name? or name == ""
			return "?"
		return name
