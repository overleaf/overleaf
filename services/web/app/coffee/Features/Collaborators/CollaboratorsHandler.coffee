User = require('../models/User').User
Settings = require('settings-sharelatex')
EmailHandler = require("../Email/EmailHandler")
projectEntityHandler = require '../Project/ProjectEntityHandler'
mimelib = require("mimelib")



module.exports =



	changeUsersPrivlageLevel: (project_id, user_id, newPrivalageLevel, callback)->
		@removeUserFromProject project_id, user_id, =>
		  User.findById user_id, (err, user)=>
			  @addUserToProject project_id, user_id, newPrivalageLevel, callback

