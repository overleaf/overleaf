module.exports = AuthorizationManager =
	assertClientCanViewProject: (client, callback = (error) ->) ->
		AuthorizationManager._assertClientHasPrivilegeLevel client, ["readOnly", "readAndWrite", "owner"], callback

	assertClientCanEditProject: (client, callback = (error) ->) ->
		AuthorizationManager._assertClientHasPrivilegeLevel client, ["readAndWrite", "owner"], callback
				
	_assertClientHasPrivilegeLevel: (client, allowedLevels, callback = (error) ->) ->
		client.get "privilege_level", (error, privilegeLevel) ->
			return callback(error) if error?
			allowed = (privilegeLevel in allowedLevels)
			if allowed
				callback null
			else
				callback new Error("not authorized")

	assertClientCanViewProjectAndDoc: (client, doc_id, callback = (error) ->) ->
		AuthorizationManager.assertClientCanViewProject client, (error) ->
			return callback(error) if error?
			AuthorizationManager._assertClientCanAccessDoc client, doc_id, callback

	assertClientCanEditProjectAndDoc: (client, doc_id, callback = (error) ->) ->
		AuthorizationManager.assertClientCanEditProject client, (error) ->
			return callback(error) if error?
			AuthorizationManager._assertClientCanAccessDoc client, doc_id, callback

	_assertClientCanAccessDoc: (client, doc_id, callback = (error) ->) ->
		client.get "doc:#{doc_id}", (error, status) ->
			return callback(error) if error?
			if status? and status is "allowed"
				callback null
			else
				callback new Error("not authorized")

	addAccessToDoc: (client, doc_id, callback = (error) ->) ->
		client.set("doc:#{doc_id}", "allowed", callback)

	removeAccessToDoc: (client, doc_id, callback = (error) ->) ->
		client.del("doc:#{doc_id}", callback)
