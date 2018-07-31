ExportsHandler = require("./ExportsHandler")
AuthenticationController = require("../Authentication/AuthenticationController")
logger = require("logger-sharelatex")

module.exports =

	exportProject: (req, res) ->
		{project_id, brand_variation_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		export_params = {
			project_id: project_id,
			brand_variation_id: brand_variation_id,
			user_id: user_id
		}

		if req.body && req.body.firstName && req.body.lastName
			export_params.first_name = req.body.firstName.trim()
			export_params.last_name = req.body.lastName.trim()

		ExportsHandler.exportProject export_params, (err, export_data) ->
			return next(err) if err?
			logger.log 
				user_id:user_id
				project_id: project_id
				brand_variation_id:brand_variation_id
				export_v1_id:export_data.v1_id
				"exported project"
			res.send export_v1_id: export_data.v1_id

	exportStatus: (req, res) ->
		{export_id} = req.params
		ExportsHandler.fetchExport export_id, (err, export_json) ->
			return next(err) if err?
			parsed_export = JSON.parse(export_json)
			json = {
				status_summary: parsed_export.status_summary,
				status_detail: parsed_export.status_detail
			}
			res.send export_json: json

	exportZip: (req, res) ->
		{export_id} = req.params
		AuthenticationController.getLoggedInUserId(req)
		ExportsHandler.fetchZip export_id, (err, export_zip_url) ->
			return err if err?

			res.redirect export_zip_url
