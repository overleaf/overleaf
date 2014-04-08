request = require('request')
settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
Project = require('../../models/Project').Project
projectEntityHandler = require '../Project/ProjectEntityHandler'
_ = require('underscore')
async = require('async')

module.exports =

	getUserRegistrationStatus: (user_id, callback)->
		logger.log user_id:user_id, "getting dropbox registration status from tpds"
		opts =
			url : "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/dropbox/status"
			timeout: 5000
		request.get opts, (err, response, body)->
			safelyGetResponse err, response, body, (err, body)->
				if err?
					logger.err err:err, response:response, "getUserRegistrationStatus problem"
					return callback err
				logger.log status:body, "getting dropbox registration status for user #{user_id}"
				callback err, body

	getDropboxRegisterUrl: (user_id, callback)->
		opts =
			url: "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/dropbox/register"
			timeout: 5000
		request.get opts, (err, response, body)->
			safelyGetResponse err, response, body, (err, body)->
				if err?
					logger.err err:err, response:response, "getUserRegistrationStatus problem"
					return callback err
				url = "#{body.authorize_url}&oauth_callback=#{settings.siteUrl}/dropbox/completeRegistration"
				logger.log user_id:user_id, url:url, "starting dropbox register"
				callback err, url

	completeRegistration: (user_id, callback)->
		opts =
			url: "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/dropbox/getaccesstoken"
			timeout: 5000
		request.get opts, (err, response, body)=>
			safelyGetResponse err, response, body, (err, body)=>
				if err?
					logger.err err:err, response:response, "getUserRegistrationStatus problem"
					return callback err
				success = body.success
				logger.log user_id:user_id, success:body.success, "completing dropbox register"
				if success
					@flushUsersProjectToDropbox user_id
				callback err, body.success


	unlinkAccount: (user_id, callback)->
		opts =
			url: "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/dropbox"
			timeout: 5000
		request.del opts, (err, response, body)=>
			callback(err)

	flushUsersProjectToDropbox: (user_id, callback)->
		Project.findAllUsersProjects user_id, '_id', (err, projects = [], collabertions = [], readOnlyProjects = [])->
			projectList = []
			projectList = projectList.concat(projects)
			projectList = projectList.concat(collabertions)
			projectList = projectList.concat(readOnlyProjects)
			projectIds = _.pluck(projectList, "_id")
			logger.log projectIds:projectIds, user_id:user_id, "flushing all a users projects to tpds"
			jobs = projectIds.map (project_id)->
				return (cb)->
					projectEntityHandler.flushProjectToThirdPartyDataStore project_id, cb
			async.series jobs, callback

safelyGetResponse = (err, res, body, callback)->
	statusCode =  if res? then res.statusCode else 500
	if err? or statusCode != 200
		e = new Error("something went wrong getting response from dropbox, #{err}, #{statusCode}")
		logger.err err:err
		callback(e, [])
	else
		body = JSON.parse body
		callback(null, body)
