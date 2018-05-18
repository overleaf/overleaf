ExportsHandler = require("./ExportsHandler")
AuthenticationController = require("../Authentication/AuthenticationController")
logger = require("logger-sharelatex")

module.exports =

	exportProject: (req, res) ->
		{project_id, brand_variation_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		ExportsHandler.exportProject project_id, user_id, brand_variation_id, (err, export_data) ->
			logger.log 
				user_id:user_id
				project_id: project_id
				brand_variation_id:brand_variation_id
				export_v1_id:export_data.v1_id
				"exported project"
			res.send export_v1_id: export_data.v1_id

