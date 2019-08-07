/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore')
const { expect } = require('chai')
const { ObjectId } = require('mongojs')
const request = require('./helpers/request')

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const User = require('./helpers/User')

describe('Labels', function() {
  beforeEach(function(done) {
    this.owner = new User()
    return this.owner.login(error => {
      if (error != null) {
        throw error
      }
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, project_id) => {
          this.project_id = project_id
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  afterEach(function() {
    return MockProjectHistoryApi.reset()
  })

  it('getting labels', function(done) {
    const label_id = new ObjectId().toString()
    const comment = 'a label comment'
    const version = 3
    MockProjectHistoryApi.addLabel(this.project_id, {
      id: label_id,
      comment,
      version
    })

    return this.owner.request(
      {
        method: 'GET',
        url: `/project/${this.project_id}/labels`,
        json: true
      },
      (error, response, body) => {
        if (error != null) {
          throw error
        }
        expect(response.statusCode).to.equal(200)
        expect(body).to.deep.equal([{ id: label_id, comment, version }])
        return done()
      }
    )
  })

  it('creating a label', function(done) {
    const comment = 'a label comment'
    const version = 3

    return this.owner.request(
      {
        method: 'POST',
        url: `/project/${this.project_id}/labels`,
        json: { comment, version }
      },
      (error, response, body) => {
        if (error != null) {
          throw error
        }
        expect(response.statusCode).to.equal(200)
        const { label_id } = body
        expect(MockProjectHistoryApi.getLabels(this.project_id)).to.deep.equal([
          { id: label_id, comment, version }
        ])
        return done()
      }
    )
  })

  it('deleting a label', function(done) {
    const label_id = new ObjectId().toString()
    const comment = 'a label comment'
    const version = 3
    MockProjectHistoryApi.addLabel(this.project_id, {
      id: label_id,
      comment,
      version
    })

    return this.owner.request(
      {
        method: 'DELETE',
        url: `/project/${this.project_id}/labels/${label_id}`,
        json: true
      },
      (error, response, body) => {
        if (error != null) {
          throw error
        }
        expect(response.statusCode).to.equal(204)
        expect(MockProjectHistoryApi.getLabels(this.project_id)).to.deep.equal(
          []
        )
        return done()
      }
    )
  })
})
