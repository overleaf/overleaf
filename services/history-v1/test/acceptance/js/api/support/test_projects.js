const BPromise = require('bluebird')
const { expect } = require('chai')
const HTTPStatus = require('http-status')
const assert = require('../../../../../storage/lib/assert')

const testServer = require('./test_server')

/**
 * Without a provided history id, a new one will get generated.
 * The history id could either be a mongo id, or a postgres id.
 *
 * @param {string} [existingHistoryId]
 * @return {Promise<string>}
 */
exports.createEmptyProject = function (existingHistoryId) {
  return BPromise.resolve(
    testServer.basicAuthClient.apis.Project.initializeProject({
      body: { projectId: existingHistoryId },
    })
  ).then(response => {
    expect(response.status).to.equal(HTTPStatus.OK)
    const { projectId } = response.obj
    assert.projectId(projectId, 'bad projectId')
    return projectId
  })
}
