module.exports = AuthorizationManager =
	assertClientCanViewProject: (client, callback = (error) ->) ->
		AuthorizationManager._assertClientHasPrivilegeLevel client, ["readOnly", "readAndWrite", "owner"], callback
		
	_assertClientHasPrivilegeLevel: (client, allowedLevels, callback = (error) ->) ->
		client.get "privilege_level", (error, privilegeLevel) ->
			return callback(error) if error?
			allowed = (privilegeLevel in allowedLevels)
			if allowed
				callback null
			else
				callback new Error("not authorized")