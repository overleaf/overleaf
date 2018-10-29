ProjectGetter = require('../Project/ProjectGetter')
ProjectLocator = require('../Project/ProjectLocator')
ProjectRootDocManager = require('../Project/ProjectRootDocManager')
UserGetter = require('../User/UserGetter')
logger = require('logger-sharelatex')
settings = require 'settings-sharelatex'
async = require 'async'
request = require 'request'
request = request.defaults()
settings = require 'settings-sharelatex'

module.exports = ExportsHandler = self =

	exportProject: (export_params, callback=(error, export_data) ->) ->
		self._buildExport export_params, (err, export_data) ->
			return callback(err) if err?
			self._requestExport export_data, (err, export_v1_id) ->
				return callback(err) if err?
				export_data.v1_id = export_v1_id
				# TODO: possibly store the export data in Mongo
				callback null, export_data

	_buildExport: (export_params, callback=(err, export_data) ->) ->
		{project_id, user_id, brand_variation_id, title, description, author,
			license, show_source} = export_params
		jobs =
			project: (cb) ->
				ProjectGetter.getProject project_id, cb
			# TODO: when we update async, signature will change from (cb, results) to (results, cb)
			rootDoc: [ 'project', (cb, results) ->
				ProjectRootDocManager.ensureRootDocumentIsSet project_id, (error) ->
					return callback(error) if error?
					ProjectLocator.findRootDoc {project: results.project, project_id: project_id}, cb
			]
			user: (cb) ->
				UserGetter.getUser user_id, {first_name: 1, last_name: 1, email: 1, overleaf: 1}, cb
			historyVersion: (cb) ->
				self._requestVersion project_id, cb

		async.auto jobs, (err, results) ->
			if err?
				logger.err err:err, project_id:project_id, user_id:user_id, brand_variation_id:brand_variation_id, "error building project export"
				return callback(err)

			{project, rootDoc, user, historyVersion} = results
			if !rootDoc[1]?
				err = new Error("cannot export project without root doc")
				logger.err err:err, project_id: project_id
				return callback(err)

			if export_params.first_name && export_params.last_name
				user.first_name = export_params.first_name
				user.last_name = export_params.last_name

			export_data =
				project:
					id: project_id
					rootDocPath: rootDoc[1]?.fileSystem
					historyId: project.overleaf?.history?.id
					historyVersion: historyVersion
					v1ProjectId: project.overleaf?.id
					metadata:
						compiler: project.compiler
						imageName: project.imageName
						title: title
						description: description
						author: author
						license: license
						showSource: show_source
				user:
					id: user_id
					firstName: user.first_name
					lastName: user.last_name
					email: user.email
					orcidId: null # until v2 gets ORCID
					v1UserId: user.overleaf?.id
				destination:
					brandVariationId: brand_variation_id
				options:
					callbackUrl: null # for now, until we want v1 to call us back
			callback null, export_data

	_requestExport: (export_data, callback=(err, export_v1_id) ->) ->
		request.post {
			url: "#{settings.apis.v1.url}/api/v1/sharelatex/exports"
			auth: {user: settings.apis.v1.user, pass: settings.apis.v1.pass }
			json: export_data
		}, (err, res, body) ->
			if err?
				logger.err err:err, export:export_data, "error making request to v1 export"
				callback err
			else if 200 <= res.statusCode < 300
				callback null, body.exportId
			else
				err = new Error("v1 export returned a failure status code: #{res.statusCode}")
				logger.err err:err, export:export_data, "v1 export returned failure status code: #{res.statusCode}"
				callback err

	_requestVersion: (project_id, callback=(err, export_v1_id) ->) ->
		request.get {
			url: "#{settings.apis.project_history.url}/project/#{project_id}/version"
			json: true
		}, (err, res, body) ->
			if err?
				logger.err err:err, project_id:project_id, "error making request to project history"
				callback err
			else if res.statusCode >= 200 and res.statusCode < 300
				callback null, body.version
			else
				err = new Error("project history version returned a failure status code: #{res.statusCode}")
				logger.err err:err, project_id:project_id, "project history version returned failure status code: #{res.statusCode}"
				callback err

	fetchExport: (export_id, callback=(err, export_json) ->) ->
		request.get {
			url: "#{settings.apis.v1.url}/api/v1/sharelatex/exports/#{export_id}"
			auth: {user: settings.apis.v1.user, pass: settings.apis.v1.pass }
		}, (err, res, body) ->
			if err?
				logger.err err:err, export:export_id, "error making request to v1 export"
				callback err
			else if 200 <= res.statusCode < 300
				callback null, body
			else
				err = new Error("v1 export returned a failure status code: #{res.statusCode}")
				logger.err err:err, export:export_id, "v1 export returned failure status code: #{res.statusCode}"
				callback err

	fetchDownload: (export_id, type, callback=(err, file_url) ->) ->
		request.get {
			url: "#{settings.apis.v1.url}/api/v1/sharelatex/exports/#{export_id}/#{type}_url"
			auth: {user: settings.apis.v1.user, pass: settings.apis.v1.pass }
		}, (err, res, body) ->
			if err?
				logger.err err:err, export:export_id, "error making request to v1 export"
				callback err
			else if 200 <= res.statusCode < 300
				callback null, body
			else
				err = new Error("v1 export returned a failure status code: #{res.statusCode}")
				logger.err err:err, export:export_id, "v1 export zip fetch returned failure status code: #{res.statusCode}"
				callback err
