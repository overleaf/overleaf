module.exports =
	getPrivilegeLevelForProject: (user_id, project_id, callback = (error, canAccess, privilegeLevel) ->) ->
		return callback(null, true, "readAndWrite")
		
	canUserReadProject: (user_id, project_id, callback = (error, canRead) ->) ->
		
	canUserWriteProjectSettings: (user_id, project_id, callback = (error, canWriteSettings) ->) ->
	
	canUserAdminProject: (user_id, project_id, callback = (error, canAdmin) ->) ->
	
	isUserSiteAdmin: (user_id, callback = (error, isAdmin) ->) ->
		