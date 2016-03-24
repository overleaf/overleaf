settings = require("settings-sharelatex")

module.exports =


	getConvertedFolderKey: (key)->
		key = "#{key}-converted-cache/"

	addCachingToKey: (key, opts)->
		key = @getConvertedFolderKey(key)
		if opts.format? and !opts.style?
			key = "#{key}format-#{opts.format}"
		if opts.style? and !opts.format?
			key = "#{key}style-#{opts.style}"
		if opts.style? and opts.format?
			key = "#{key}format-#{opts.format}-style-#{opts.style}"
		return key


	userFileKey: (req, res, next)->
		{project_id, file_id} = req.params
		req.key = "#{project_id}/#{file_id}"
		req.bucket = settings.filestore.stores.user_files
		next()
		
	publicFileKey: (req, res, next)->
		{project_id, public_file_id} = req.params
		if not settings.filestore.stores.public_files?
			res.status(501).send("public files not available")
		else
			req.key = "#{project_id}/#{public_file_id}"
			req.bucket = settings.filestore.stores.public_files
			next()

	templateFileKey: (req, res, next)->
		{template_id, format, version, sub_type} = req.params
		req.key = "#{template_id}/v/#{version}/#{format}"
		if sub_type?
			req.key = "#{req.key}/#{sub_type}"
		req.bucket = settings.filestore.stores.template_files
		req.version = version
		opts = req.query
		next()

	publicProjectKey: (req, res, next)->
		{project_id} = req.params
		req.project_id = project_id
		req.bucket = settings.filestore.stores.user_files
		next()
	
