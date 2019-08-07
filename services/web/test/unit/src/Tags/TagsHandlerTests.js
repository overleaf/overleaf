/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsHandler.js'
)
const _ = require('underscore')

describe('TagsHandler', function() {
  const user_id = 'user-id-123'
  const tag_id = 'tag-id-123'
  const project_id = 'project-id-123'
  const tagsUrl = 'tags.sharelatex.testing'
  const tag = 'tag_name'

  beforeEach(function() {
    this.request = {
      post: sinon.stub().callsArgWith(1),
      del: sinon.stub().callsArgWith(1),
      get: sinon.stub()
    }
    this.callback = sinon.stub()
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': {
          apis: { tags: { url: tagsUrl } }
        },
        request: this.request,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        }
      }
    }))
  })

  describe('removeProjectFromAllTags', function() {
    it('should tell the tags api to remove the project_id from all the users tags', function(done) {
      return this.handler.removeProjectFromAllTags(user_id, project_id, () => {
        this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${user_id}/project/${project_id}`,
            timeout: 1000
          })
          .should.equal(true)
        return done()
      })
    })
  })

  describe('_requestTags', function() {
    it('should return an err and empty array on error', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        { statusCode: 200 },
        []
      )
      return this.handler._requestTags(user_id, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        return done()
      })
    })

    it('should return an err and empty array on no body', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        { statusCode: 200 },
        undefined
      )
      return this.handler._requestTags(user_id, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        return done()
      })
    })

    it('should return an err and empty array on non 200 response', function(done) {
      this.request.get.callsArgWith(1, null, { statusCode: 201 }, [])
      return this.handler._requestTags(user_id, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        return done()
      })
    })

    it('should return an err and empty array on no body and no response', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        undefined,
        undefined
      )
      return this.handler._requestTags(user_id, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        return done()
      })
    })
  })

  describe('getAllTags', function() {
    it('should get all tags', function(done) {
      const stubbedAllTags = [
        { name: 'tag', project_ids: ['123423', '423423'] }
      ]
      this.request.get.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        stubbedAllTags
      )
      return this.handler.getAllTags(user_id, (err, allTags) => {
        stubbedAllTags.should.deep.equal(allTags)
        const getOpts = {
          url: `${tagsUrl}/user/${user_id}/tag`,
          json: true,
          timeout: 1000
        }
        this.request.get.calledWith(getOpts).should.equal(true)
        return done()
      })
    })

    it('should return empty arrays if there are no tags', function() {
      this.request.get.callsArgWith(1, null, { statusCode: 200 }, null)
      return this.handler.getAllTags(
        user_id,
        (err, allTags, projectGroupedTags) => {
          allTags.length.should.equal(0)
          return _.size(projectGroupedTags).should.equal(0)
        }
      )
    })
  })

  describe('createTag', function() {
    beforeEach(function() {
      this.request.post = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 204 }, '')
      return this.handler.createTag(
        user_id,
        (this.name = 'tag_name'),
        this.callback
      )
    })

    it('should send a request to the tag backend', function() {
      return this.request.post
        .calledWith({
          url: `${tagsUrl}/user/${user_id}/tag`,
          json: {
            name: this.name
          },
          timeout: 1000
        })
        .should.equal(true)
    })

    it('should call the callback with no error', function() {
      return this.callback.calledWith(null).should.equal(true)
    })
  })

  describe('deleteTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.deleteTag(user_id, tag_id, this.callback)
      })

      it('should send a request to the tag backend', function() {
        return this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${user_id}/tag/${tag_id}`,
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.deleteTag(user_id, tag_id, this.callback)
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })

  describe('renameTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.renameTag(
          user_id,
          tag_id,
          (this.name = 'new-name'),
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        return this.request.post
          .calledWith({
            url: `${tagsUrl}/user/${user_id}/tag/${tag_id}/rename`,
            json: {
              name: this.name
            },
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.renameTag(user_id, tag_id, 'name', this.callback)
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })

  describe('removeProjectFromTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.removeProjectFromTag(
          user_id,
          tag_id,
          project_id,
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        return this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${user_id}/tag/${tag_id}/project/${project_id}`,
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.removeProjectFromTag(
          user_id,
          tag_id,
          project_id,
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })

  describe('addProjectToTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.addProjectToTag(
          user_id,
          tag_id,
          project_id,
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        return this.request.post
          .calledWith({
            url: `${tagsUrl}/user/${user_id}/tag/${tag_id}/project/${project_id}`,
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.addProjectToTag(
          user_id,
          tag_id,
          project_id,
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })

  describe('addProjectToTagName', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.addProjectToTagName(
          user_id,
          tag,
          project_id,
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        return this.request.post
          .calledWith({
            json: {
              name: tag
            },
            url: `${tagsUrl}/user/${user_id}/tag/project/${project_id}`,
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.addProjectToTagName(
          user_id,
          tag_id,
          project_id,
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })

  describe('updateTagUserIds', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.put = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.handler.updateTagUserIds(
          'old-user-id',
          'new-user-id',
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        return this.request.put
          .calledWith({
            json: {
              user_id: 'new-user-id'
            },
            url: `${tagsUrl}/user/old-user-id/tag`,
            timeout: 1000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.put = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.handler.updateTagUserIds(
          'old-user-id',
          'new-user-id',
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })
  })
})
