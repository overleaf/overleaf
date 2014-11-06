SecurityManager = require("../../managers/SecurityManager")
TemplatesWebController = require("./TemplatesWebController")
TemplatesController = require("./TemplatesController")
middleWear = require("./TemplatesMiddlewear")

module.exports = 
	apply: (app)->

		app.get "/templates", middleWear.insert_templates_user_id, TemplatesWebController.renderTemplatesIndexPage
		app.get "/templates/user/:user_id", TemplatesWebController.renderTemplatesIndexPage

		app.get "/templates/:tag_or_template_id", middleWear.id_or_tag_parse, middleWear.insert_templates_user_id, TemplatesWebController.tagOrCanonicalPage
		app.get "/templates/user/:user_id/:tag_or_template_id", middleWear.id_or_tag_parse, TemplatesWebController.tagOrCanonicalPage

		app.get "/templates/:tag_name/:template_name", middleWear.insert_templates_user_id, TemplatesWebController.renerTemplateInTag
		app.get "/templates/user/:user_id/:tag_name/:template_name", TemplatesWebController.renerTemplateInTag

		app.get "/templates/:template_id/v/:version/:file_type", TemplatesWebController.proxyToTemplatesApi

		app.post "/project/:Project_id/template/publish", SecurityManager.requestIsOwner, TemplatesController.publishProject
		app.post "/project/:Project_id/template/unpublish", SecurityManager.requestIsOwner, TemplatesController.unpublishProject
		app.post "/project/:Project_id/template/description", SecurityManager.requestCanModifyProject, TemplatesController.updateProjectDescription
		app.get  "/project/:Project_id/template", SecurityManager.requestCanAccessProject, TemplatesController.getTemplateDetails