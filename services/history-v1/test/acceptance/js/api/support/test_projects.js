const BPromise = require('bluebird')
const { expect } = require('chai')
const HTTPStatus = require('http-status')
const assert = require('../../../../../storage/lib/assert')

const testServer = require('./test_server')

exports.createEmptyProject = function () {
  return BPromise.resolve(
    testServer.basicAuthClient.apis.Project.initializeProject()
  ).then(response => {
    expect(response.status).to.equal(HTTPStatus.OK)
    const { projectId } = response.obj
    assert.projectId(projectId, 'bad projectId')
    return projectId
  })
}
