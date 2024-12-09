const { NotAuthorizedError } = require('./Errors')

let AuthorizationManager
module.exports = AuthorizationManager = {
  assertClientCanViewProject(client, callback) {
    AuthorizationManager._assertClientHasPrivilegeLevel(
      client,
      ['readOnly', 'readAndWrite', 'review', 'owner'],
      callback
    )
  },

  assertClientCanEditProject(client, callback) {
    AuthorizationManager._assertClientHasPrivilegeLevel(
      client,
      ['readAndWrite', 'owner'],
      callback
    )
  },

  assertClientCanReviewProject(client, callback) {
    AuthorizationManager._assertClientHasPrivilegeLevel(
      client,
      ['readAndWrite', 'owner', 'review'],
      callback
    )
  },

  _assertClientHasPrivilegeLevel(client, allowedLevels, callback) {
    if (allowedLevels.includes(client.ol_context.privilege_level)) {
      callback(null)
    } else {
      callback(new NotAuthorizedError())
    }
  },

  assertClientCanViewProjectAndDoc(client, docId, callback) {
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      AuthorizationManager._assertClientCanAccessDoc(client, docId, callback)
    })
  },

  assertClientCanEditProjectAndDoc(client, docId, callback) {
    AuthorizationManager.assertClientCanEditProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      AuthorizationManager._assertClientCanAccessDoc(client, docId, callback)
    })
  },

  assertClientCanReviewProjectAndDoc(client, docId, callback) {
    AuthorizationManager.assertClientCanReviewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      AuthorizationManager._assertClientCanAccessDoc(client, docId, callback)
    })
  },

  _assertClientCanAccessDoc(client, docId, callback) {
    if (client.ol_context[`doc:${docId}`] === 'allowed') {
      callback(null)
    } else {
      callback(new NotAuthorizedError())
    }
  },

  addAccessToDoc(client, docId, callback) {
    client.ol_context[`doc:${docId}`] = 'allowed'
    callback(null)
  },

  removeAccessToDoc(client, docId, callback) {
    delete client.ol_context[`doc:${docId}`]
    callback(null)
  },
}
