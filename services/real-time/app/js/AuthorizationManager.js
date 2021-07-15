/* eslint-disable
    camelcase,
*/
const { NotAuthorizedError } = require('./Errors')

let AuthorizationManager
module.exports = AuthorizationManager = {
  assertClientCanViewProject(client, callback) {
    AuthorizationManager._assertClientHasPrivilegeLevel(
      client,
      ['readOnly', 'readAndWrite', 'owner'],
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

  _assertClientHasPrivilegeLevel(client, allowedLevels, callback) {
    if (allowedLevels.includes(client.ol_context.privilege_level)) {
      callback(null)
    } else {
      callback(new NotAuthorizedError())
    }
  },

  assertClientCanViewProjectAndDoc(client, doc_id, callback) {
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      AuthorizationManager._assertClientCanAccessDoc(client, doc_id, callback)
    })
  },

  assertClientCanEditProjectAndDoc(client, doc_id, callback) {
    AuthorizationManager.assertClientCanEditProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      AuthorizationManager._assertClientCanAccessDoc(client, doc_id, callback)
    })
  },

  _assertClientCanAccessDoc(client, doc_id, callback) {
    if (client.ol_context[`doc:${doc_id}`] === 'allowed') {
      callback(null)
    } else {
      callback(new NotAuthorizedError())
    }
  },

  addAccessToDoc(client, doc_id, callback) {
    client.ol_context[`doc:${doc_id}`] = 'allowed'
    callback(null)
  },

  removeAccessToDoc(client, doc_id, callback) {
    delete client.ol_context[`doc:${doc_id}`]
    callback(null)
  },
}
