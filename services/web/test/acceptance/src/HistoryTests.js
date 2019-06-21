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
const { expect } = require('chai')

const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')
const MockV1HistoryApi = require('./helpers/MockV1HistoryApi')
const User = require('./helpers/User')

describe('History', function() {
  beforeEach(function(done) {
    this.owner = new User()
    return this.owner.login(done)
  })

  describe('zip download of version', function() {
    it('should stream the zip file of a version', function(done) {
      return this.owner.createProject(
        'example-project',
        (error, project_id) => {
          this.project_id = project_id
          if (error != null) {
            return done(error)
          }
          this.v1_history_id = 42
          return db.projects.update(
            {
              _id: ObjectId(this.project_id)
            },
            {
              $set: {
                'overleaf.history.id': this.v1_history_id
              }
            },
            error => {
              if (error != null) {
                return done(error)
              }
              return this.owner.request(
                `/project/${this.project_id}/version/42/zip`,
                (error, response, body) => {
                  if (error != null) {
                    return done(error)
                  }
                  expect(response.statusCode).to.equal(200)
                  expect(response.headers['content-type']).to.equal(
                    'application/zip'
                  )
                  expect(response.headers['content-disposition']).to.equal(
                    'attachment; filename="example-project%20(Version%2042).zip"'
                  )
                  expect(body).to.equal(
                    `Mock zip for ${this.v1_history_id} at version 42`
                  )
                  return done()
                }
              )
            }
          )
        }
      )
    })

    it('should return 402 for non-v2-history project', function(done) {
      return this.owner.createProject('non-v2-project', (error, project_id) => {
        this.project_id = project_id
        if (error != null) {
          return done(error)
        }
        return db.projects.update(
          {
            _id: ObjectId(this.project_id)
          },
          {
            $unset: {
              'overleaf.history.id': true
            }
          },
          error => {
            if (error != null) {
              return done(error)
            }
            return this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(402)
                return done()
              }
            )
          }
        )
      })
    })
  })
})
