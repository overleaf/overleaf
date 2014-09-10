request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = TemplatesWebController =

	renderTemplatesIndexPage: (req, res)->
		logger.log "rendering index page of templates"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{req.params.user_id}", (err, data)->
			if err? or !data?
				logger.err err:err, "something went wrong in renderTemplatesIndexPage"
				return res.send 500
			data.title = "latex_templates"
			res.render "templates/index", data

	renerTemplateInTag: (req, res)->
		{user_id, tag_name, template_name} = req.params
		logger.log user_id:user_id, tag_name:tag_name, template_name:template_name, "rendering latex template page"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/tag/#{tag_name}/template/#{template_name}", (err, data)->
			if err? or !data?
				logger.err err:err, user_id:user_id, tag_name:tag_name, template_name:template_name, "something went wrong in renerTemplateInTag"
				return res.send 500
			data.title = data?.template?.name
			res.render "templates/template", data

	tagOrCanonicalPage: (req, res)->
		if req.params.template_id?
			TemplatesWebController._renderCanonicalPage(req, res)
		else if req.params.tag_name?.toLowerCase() == "all"
			TemplatesWebController._renderAllTemplatesPage(req, res)
		else if req.params.tag_name?
			TemplatesWebController._renderTagPage(req, res)
		else
			logger.log params:req.params, "problem rendering tagOrCanonicalPage"
			res.send 500

	proxyToTemplatesApi: (req, res)->
		url = req.url
		
		name = req.query.name or "Template"
		if req.query.inline?
			disposition = "inline"
		else
			disposition = "attachment"
		res.header({"content-disposition": "#{disposition}; filename=#{name}.#{req.params.file_type};"})
		
		logger.log url:url, template_name: name, disposition: disposition, "proxying request to templates api"
		
		getReq = request.get("#{settings.apis.templates.url}#{url}")
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "templates proxy API error"
			res.send 500

	_renderCanonicalPage: (req, res)->
		{user_id, template_id} = req.params
		logger.log user_id:user_id, template_id:template_id, "rendering template page"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/template/#{template_id}", (err, data)->
			if err?
				logger.err err:err, user_id:user_id, template_id:template_id, "something went wrong in _renderCanonicalPage"
				return res.send 500
			data.title = data?.template?.name
			data.tag = null
			res.render "templates/template", data

	_renderAllTemplatesPage: (req, res)->
		{user_id} = req.params
		logger.log user_id:user_id, "rendering all templates page"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/all", (err, data)->
			if err?
				logger.err err:err, user_id:user_id, "something went wrong in _renderCanonicalPage"
				return res.send 500
			data.title = "all_templates"
			res.render "templates/tag", data

	_renderTagPage:  (req, res)->
		{user_id, tag_name} = req.params
		logger.log user_id:user_id, tag_name:tag_name, "rendinging tag page for templates"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/tag/#{tag_name}", (err, data)->
			if err?
				logger.err err:err, user_id:user_id, tag_name:tag_name, "something went wrong in _renderCanonicalPage"
				return res.send 500
			data.title = data?.tag?.name
			res.render "templates/tag", data

	_getDataFromTemplatesApi: (path, callback)->
		opts = 
			url: "#{settings.apis.templates.url}#{path}"
			json:true
		request.get opts, (err, response, data)->
			callback err, data