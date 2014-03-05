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
		
	templateFileKey: (req, res, next)->
		{template_id, format, version} = req.params
		req.key = "#{template_id}/v/#{version}/#{format}"
		req.bucket = settings.filestore.stores.template_files
		req.version = version
		opts = req.query
		next()

	
