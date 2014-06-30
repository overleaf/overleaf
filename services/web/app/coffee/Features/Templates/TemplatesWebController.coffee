request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = TemplatesWebController =

	renderTemplatesIndexPage: (req, res)->
		logger.log "rendering index page of templates"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{req.params.user_id}", (err, data)->
			data.title = "LaTeX Templates"
			res.render "templates/index", data

	renerTemplateInTag: (req, res)->
		logger.log "rendering latex template page"
		{user_id, tag_name, template_name} = req.params
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/tag/#{tag_name}/template/#{template_name}", (err, data)->
			data.title = data.template.name
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
		logger.log url:url, "proxying request to templates api"
		getReq = request.get("#{settings.apis.templates_api.url}#{url}")
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "templates proxy API error"
			res.send 500

	_renderCanonicalPage: _renderCanonicalPage = (req, res)->
		{user_id, template_id} = req.params
		logger.log user_id:user_id, template_id:template_id, "rendering template page"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/template/#{template_id}", (err, data)->
			data.tag = null
			res.render "templates/template", data

	_renderAllTemplatesPage: _renderAllTemplatesPage = (req, res)->
		{user_id} = req.params
		logger.log user_id:user_id, "rendering all templates page"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/all", (err, data)->
			data.title = "All Templates"
			res.render "templates/tag", data

	_renderTagPage: _renderTagPage = (req, res)->
		{user_id, tag_name} = req.params
		logger.log user_id:user_id, tag_name:tag_name, "rendinging tag page for templates"
		TemplatesWebController._getDataFromTemplatesApi "/user/#{user_id}/tag/#{tag_name}", (err, data)->
			data.title = data.tag.name
			res.render "templates/tag", data

	_getDataFromTemplatesApi: _getDataFromTemplatesApi = (path, callback)->
		opts = 
			url: "#{settings.apis.templates_api.url}#{path}"
			json:true
		request.get opts, (err, response, data)->
			callback err, data