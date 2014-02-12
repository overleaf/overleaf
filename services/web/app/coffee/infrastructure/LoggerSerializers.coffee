module.exports =
	user: (user) ->
		if !user._id?
			user = {_id : user}
		return {
			id: user._id
			email: user.email
			first_name: user.name
			last_name: user.name
		}
	
	project: (project) ->
		if !project._id?
			project = {_id: project}
		return {
			id: project._id
			name: project.name
		}
