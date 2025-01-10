import User from './helpers/User.mjs'
import async from 'async'
import { expect } from 'chai'
import _ from 'lodash'
import request from './helpers/request.js'
import expectErrorResponse from './helpers/expectErrorResponse.mjs'

const _initUser = (user, callback) => {
  async.series([cb => user.login(cb), cb => user.getCsrfToken(cb)], callback)
}

const _initUsers = (users, callback) => {
  async.each(users, _initUser, callback)
}

const _expect200 = (err, response) => {
  expect(err).to.not.exist
  expect(response.statusCode).to.equal(200)
}

const _expect204 = (err, response) => {
  expect(err).to.not.exist
  expect(response.statusCode).to.equal(204)
}

const _createTag = (user, name, callback) => {
  user.request.post({ url: `/tag`, json: { name } }, callback)
}

const _createTags = (user, tagNames, callback) => {
  const tags = []
  async.series(
    tagNames.map(
      tagName => cb =>
        _createTag(user, tagName, (err, response, body) => {
          _expect200(err, response)
          tags.push(body)
          cb()
        })
    ),
    err => {
      callback(err, tags)
    }
  )
}

const _getTags = (user, callback) => {
  user.request.get({ url: `/tag`, json: true }, callback)
}

const _names = tags => {
  return tags.map(tag => tag.name)
}

const _ids = tags => {
  return tags.map(tag => tag._id)
}

const _expectTagStructure = tag => {
  expect(tag).to.have.keys('_id', 'user_id', 'name', 'project_ids', '__v')
  expect(typeof tag._id).to.equal('string')
  expect(typeof tag.user_id).to.equal('string')
  expect(typeof tag.name).to.equal('string')
  expect(tag.project_ids).to.deep.equal([])
}

describe('Tags', function () {
  beforeEach(function (done) {
    this.user = new User()
    this.otherUser = new User()
    _initUsers([this.user, this.otherUser], done)
  })

  describe('get tags, anonymous', function () {
    it('should refuse to get user tags', function (done) {
      this.user.logout(err => {
        if (err) {
          return done(err)
        }
        _getTags(this.user, (err, response, body) => {
          expect(err).to.not.exist
          expectErrorResponse.requireLogin.json(response, body)
          done()
        })
      })
    })
  })

  describe('get tags, none', function () {
    it('should get user tags', function (done) {
      _getTags(this.user, (err, response, body) => {
        _expect200(err, response)
        expect(body).to.deep.equal([])
        done()
      })
    })
  })

  describe('create some tags, then get', function () {
    it('should get tags only for that user', function (done) {
      // Create a few tags
      _createTags(this.user, ['one', 'two', 'three'], (err, tags) => {
        expect(err).to.not.exist
        // Check structure of tags we just created
        expect(tags.length).to.equal(3)
        for (const tag of tags) {
          _expectTagStructure(tag)
          expect(tag.user_id).to.equal(this.user._id.toString())
        }
        // Get the list of tags for this user
        _getTags(this.user, (err, response, body) => {
          _expect200(err, response)
          expect(body).to.be.an.instanceof(Array)
          expect(body.length).to.equal(3)
          // Check structure of each tag in response
          for (const tag of body) {
            _expectTagStructure(tag)
            expect(tag.user_id).to.equal(this.user._id.toString())
          }
          // Check that the set of ids we created are the same as
          // the ids we got in the tag-list body
          expect(_.sortBy(_ids(tags))).to.deep.equal(_.sortBy(_ids(body)))
          // Check that the other user can't see these tags
          _getTags(this.otherUser, (err, response, body) => {
            _expect200(err, response)
            expect(body).to.deep.equal([])
            done()
          })
        })
      })
    })
  })

  describe('get tags via api', function () {
    const auth = Buffer.from('overleaf:password').toString('base64')
    const authedRequest = request.defaults({
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    it('should disallow without appropriate auth headers', function (done) {
      _createTags(this.user, ['one', 'two', 'three'], (err, tags) => {
        expect(err).to.not.exist
        // Get the tags, but with a regular request, not authorized
        request.get(
          { url: `/user/${this.user._id}/tag`, json: true },
          (err, response, body) => {
            expect(err).to.not.exist
            expect(response.statusCode).to.equal(401)
            expect(body).to.equal('Unauthorized')
            done()
          }
        )
      })
    })

    it('should get the tags from api endpoint', function (done) {
      _createTags(this.user, ['one', 'two', 'three'], (err, tags) => {
        expect(err).to.not.exist
        // Get tags for user
        authedRequest.get(
          { url: `/user/${this.user._id}/tag`, json: true },
          (err, response, body) => {
            _expect200(err, response)
            expect(body.length).to.equal(3)
            // Get tags for other user, expect none
            authedRequest.get(
              { url: `/user/${this.otherUser._id}/tag`, json: true },
              (err, response, body) => {
                _expect200(err, response)
                expect(body.length).to.equal(0)
                done()
              }
            )
          }
        )
      })
    })
  })

  describe('rename tag', function () {
    it('should reject malformed tag id', function (done) {
      this.user.request.post(
        { url: `/tag/lol/rename`, json: { name: 'five' } },
        (err, response) => {
          expect(err).to.not.exist
          expect(response.statusCode).to.equal(500)
          done()
        }
      )
    })

    it('should allow user to rename a tag', function (done) {
      _createTags(this.user, ['one', 'two'], (err, tags) => {
        expect(err).to.not.exist
        // Pick out the first tag
        const firstTagId = tags[0]._id
        // Change its name
        this.user.request.post(
          { url: `/tag/${firstTagId}/rename`, json: { name: 'five' } },
          (err, response) => {
            _expect204(err, response)
            // Get the tag list
            _getTags(this.user, (err, response, body) => {
              _expect200(err, response)
              expect(body.length).to.equal(2)
              // Check the set of tag names is correct
              const tagNames = _names(body)
              expect(_.sortBy(tagNames)).to.deep.equal(
                _.sortBy(['five', 'two'])
              )
              // Check the id is the same
              const tagWithNameFive = _.find(body, t => t.name === 'five')
              expect(tagWithNameFive._id).to.equal(firstTagId)
              done()
            })
          }
        )
      })
    })

    it('should not allow other user to change name', function (done) {
      const initialTagNames = ['one', 'two']
      _createTags(this.user, initialTagNames, (err, tags) => {
        expect(err).to.not.exist
        const firstTagId = tags[0]._id
        // Post with the other user
        this.otherUser.request.post(
          { url: `/tag/${firstTagId}/rename`, json: { name: 'six' } },
          (err, response) => {
            _expect204(err, response)
            // Should not have altered the tag
            this.user.request.get(
              { url: `/tag`, json: true },
              (err, response, body) => {
                _expect200(err, response)
                expect(_.sortBy(_names(body))).to.deep.equal(
                  _.sortBy(initialTagNames)
                )
                done()
              }
            )
          }
        )
      })
    })
  })

  describe('delete tag', function () {
    it('should reject malformed tag id', function (done) {
      this.user.request.delete(
        { url: `/tag/lol`, json: { name: 'five' } },
        (err, response) => {
          expect(err).to.not.exist
          expect(response.statusCode).to.equal(500)
          done()
        }
      )
    })

    it('should delete a tag', function (done) {
      const initialTagNames = ['one', 'two', 'three']
      _createTags(this.user, initialTagNames, (err, tags) => {
        expect(err).to.not.exist
        const firstTagId = tags[0]._id
        this.user.request.delete(
          { url: `/tag/${firstTagId}` },
          (err, response) => {
            _expect204(err, response)
            // Check the tag list
            _getTags(this.user, (err, response, body) => {
              _expect200(err, response)
              expect(_.sortBy(_names(body))).to.deep.equal(
                _.sortBy(['two', 'three'])
              )
              done()
            })
          }
        )
      })
    })
  })

  describe('add project to tag', function () {
    beforeEach(function (done) {
      this.user.createProject('test 1', (err, projectId) => {
        if (err) {
          return done(err)
        }
        this.projectId = projectId
        done()
      })
    })

    it('should reject malformed tag id', function (done) {
      this.user.request.post(
        { url: `/tag/lol/project/bad` },
        (err, response) => {
          expect(err).to.not.exist
          expect(response.statusCode).to.equal(500)
          done()
        }
      )
    })

    it('should allow the user to add a project to a tag, and remove it', function (done) {
      _createTags(this.user, ['one', 'two'], (err, tags) => {
        expect(err).to.not.exist
        const firstTagId = tags[0]._id
        _getTags(this.user, (err, response, body) => {
          _expect200(err, response)
          // Confirm that project_ids is empty for this tag
          expect(
            _.find(body, tag => tag.name === 'one').project_ids
          ).to.deep.equal([])
          // Add the project to the tag
          this.user.request.post(
            { url: `/tag/${firstTagId}/project/${this.projectId}` },
            (err, response) => {
              _expect204(err, response)
              // Get tags again
              _getTags(this.user, (err, response, body) => {
                _expect200(err, response)
                // Check the project has been added to project_ids
                expect(
                  _.find(body, tag => tag.name === 'one').project_ids
                ).to.deep.equal([this.projectId])
                // Remove the project from the tag
                this.user.request.delete(
                  { url: `/tag/${firstTagId}/project/${this.projectId}` },
                  (err, response) => {
                    _expect204(err, response)
                    // Check tag list again
                    _getTags(this.user, (err, response, body) => {
                      _expect200(err, response)
                      // Check the project has been removed from project_ids
                      expect(
                        _.find(body, tag => tag.name === 'one').project_ids
                      ).to.deep.equal([])
                      done()
                    })
                  }
                )
              })
            }
          )
        })
      })
    })

    it('should not allow another user to add a project to the tag', function (done) {
      _createTags(this.user, ['one', 'two'], (err, tags) => {
        expect(err).to.not.exist
        const firstTagId = tags[0]._id
        _getTags(this.user, (err, response, body) => {
          _expect200(err, response)
          // Confirm that project_ids is empty for this tag
          expect(
            _.find(body, tag => tag.name === 'one').project_ids
          ).to.deep.equal([])
          // Have the other user try to add their own project to the tag
          this.otherUser.createProject(
            'rogue project',
            (err, rogueProjectId) => {
              expect(err).to.not.exist
              this.otherUser.request.post(
                { url: `/tag/${firstTagId}/project/${rogueProjectId}` },
                (err, response) => {
                  _expect204(err, response)
                  // Get original user tags again
                  _getTags(this.user, (err, response, body) => {
                    _expect200(err, response)
                    // Check the rogue project has not been added to project_ids
                    expect(
                      _.find(body, tag => tag.name === 'one').project_ids
                    ).to.deep.equal([])
                    done()
                  })
                }
              )
            }
          )
        })
      })
    })
  })
})
