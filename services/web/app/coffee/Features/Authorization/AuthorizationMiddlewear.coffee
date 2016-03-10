module.exports =
	ensureUserCanReadMultipleProjects: (req, res, next) ->
		next()
		
	ensureUserCanReadProject: (req, res, next) ->
		next()
		
	ensureUserCanWriteProjectSettings: (req, res, next) ->
		next()
		
	ensureUserCanWriteProjectContent: (req, res, next) ->
		next()
		
	ensureUserCanAdminProject: (req, res, next) ->
		next()
		
	ensureUserIsSiteAdmin: (req, res, next) ->
		next()
	
	restricted : (req, res, next)->
		if req.session.user?
			res.render 'user/restricted',
				title:'restricted'
		else
			logger.log "user not logged in and trying to access #{req.url}, being redirected to login"
			res.redirect '/register'
		