EditorRealTimeController = require "../Editor/EditorRealTimeController"
LabelsHandler = require './LabelsHandler'
logger = require 'logger-sharelatex'


module.exports = LabelsController =

	getAllLabels: (req, res, next) ->
		project_id = req.params.Project_id
		LabelsHandler.getAllLabelsForProject project_id, (err, projectLabels) ->
			if err?
				logger.err {project_id, err}, "[LabelsController] error getting all labels from project"
				return next(err)
			res.json {projectId: project_id, labels: projectLabels}
