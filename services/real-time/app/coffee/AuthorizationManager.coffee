module.exports = AuthorizationManager =
	assertClientCanViewProject: (client, callback = (error) ->) ->
		AuthorizationManager._assertClientHasPrivilegeLevel client, ["readOnly", "readAndWrite", "owner"], callback

	assertClientCanEditProject: (client, callback = (error) ->) ->
		AuthorizationManager._assertClientHasPrivilegeLevel client, ["readAndWrite", "owner"], callback
				
	_assertClientHasPrivilegeLevel: (client, allowedLevels, callback = (error) ->) ->
		if client.ol_context["privilege_level"] in allowedLevels
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
		if client.ol_context["doc:#{doc_id}"] is "allowed"
			callback null
		else
			callback new Error("not authorized")

	addAccessToDoc: (client, doc_id, callback = (error) ->) ->
		client.ol_context["doc:#{doc_id}"] = "allowed"
		callback(null)

	removeAccessToDoc: (client, doc_id, callback = (error) ->) ->
		delete client.ol_context["doc:#{doc_id}"]
		callback(null)
