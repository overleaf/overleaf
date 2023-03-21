/* eslint-disable
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
const { expect } = require('chai')
const _ = require('underscore')

const User = require('./helpers/User')
const MockDocstoreApiClass = require('./mocks/MockDocstoreApi')
const MockFilestoreApiClass = require('./mocks/MockFilestoreApi')

let MockDocstoreApi, MockFilestoreApi

before(function () {
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
})

describe('RestoringFiles', function () {
  beforeEach(function (done) {
    this.owner = new User()
    return this.owner.login(error => {
      if (error != null) {
        throw error
      }
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, projectId) => {
          this.project_id = projectId
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  describe('restoring a deleted doc', function () {
    beforeEach(function (done) {
      return this.owner.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.doc = _.find(
          project.rootFolder[0].docs,
          doc => doc.name === 'main.tex'
        )
        return this.owner.request(
          {
            method: 'DELETE',
            url: `/project/${this.project_id}/doc/${this.doc._id}`,
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(204)
            return this.owner.request(
              {
                method: 'POST',
                url: `/project/${this.project_id}/doc/${this.doc._id}/restore`,
                json: {
                  name: 'main.tex',
                },
              },
              (error, response, body) => {
                if (error != null) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                expect(body.doc_id).to.exist
                this.restored_doc_id = body.doc_id
                return done()
              }
            )
          }
        )
      })
    })

    it('should have restored the doc', function (done) {
      return this.owner.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        const restoredDoc = _.find(
          project.rootFolder[0].docs,
          doc => doc.name === 'main.tex'
        )
        expect(restoredDoc._id.toString()).to.equal(this.restored_doc_id)
        expect(this.doc._id).to.not.equal(this.restored_doc_id)
        expect(
          MockDocstoreApi.docs[this.project_id][this.restored_doc_id].lines
        ).to.deep.equal(
          MockDocstoreApi.docs[this.project_id][this.doc._id].lines
        )
        return done()
      })
    })
  })
})
