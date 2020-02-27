const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsHandler.js'
)
describe('TagsHandler', function() {
  const userId = 'user-id-123'
  const tagId = 'tag-id-123'
  const projectId = 'project-id-123'
  const tagsUrl = 'tags.sharelatex.testing'
  const tag = 'tag_name'

  beforeEach(function() {
    this.request = {
      post: sinon.stub().callsArgWith(1),
      del: sinon.stub().callsArgWith(1),
      get: sinon.stub()
    }
    this.callback = sinon.stub()
    this.handler = SandboxedModule.require(modulePath, {
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
    })
  })

  describe('removeProjectFromAllTags', function() {
    it('should tell the tags api to remove the project_id from all the users tags', function(done) {
      this.handler.removeProjectFromAllTags(userId, projectId, () => {
        this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${userId}/project/${projectId}`,
            timeout: 10000
          })
          .should.equal(true)
        done()
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
      this.handler.getAllTags(userId, (err, allTags) => {
        assert.notExists(err)
        stubbedAllTags.should.deep.equal(allTags)
        const getOpts = {
          url: `${tagsUrl}/user/${userId}/tag`,
          json: true,
          timeout: 10000
        }
        this.request.get.calledWith(getOpts).should.equal(true)
        done()
      })
    })

    it('should callback with an empty array on error', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        { statusCode: 200 },
        []
      )
      this.handler.getAllTags(userId, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        done()
      })
    })

    it('should callback with an empty array if there are no tags', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        { statusCode: 200 },
        undefined
      )
      this.handler.getAllTags(userId, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        done()
      })
    })

    it('should callback with an empty array on a non 200 response', function(done) {
      this.request.get.callsArgWith(1, null, { statusCode: 201 }, [])
      this.handler.getAllTags(userId, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        done()
      })
    })

    it('should callback with an empty array on no body and no response', function(done) {
      this.request.get.callsArgWith(
        1,
        { something: 'wrong' },
        undefined,
        undefined
      )
      this.handler.getAllTags(userId, (err, allTags) => {
        allTags.length.should.equal(0)
        assert.isDefined(err)
        done()
      })
    })
  })

  describe('createTag', function() {
    beforeEach(function() {
      this.request.post = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 204 }, '')
      this.handler.createTag(userId, (this.name = 'tag_name'), this.callback)
    })

    it('should send a request to the tag backend', function() {
      this.request.post
        .calledWith({
          url: `${tagsUrl}/user/${userId}/tag`,
          json: {
            name: this.name
          },
          timeout: 10000
        })
        .should.equal(true)
    })

    it('should call the callback with no error', function() {
      this.callback.calledWith(null).should.equal(true)
    })
  })

  describe('deleteTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.deleteTag(userId, tagId, this.callback)
      })

      it('should send a request to the tag backend', function() {
        this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${userId}/tag/${tagId}`,
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.deleteTag(userId, tagId, this.callback)
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('renameTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.renameTag(
          userId,
          tagId,
          (this.name = 'new-name'),
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        this.request.post
          .calledWith({
            url: `${tagsUrl}/user/${userId}/tag/${tagId}/rename`,
            json: {
              name: this.name
            },
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.renameTag(userId, tagId, 'name', this.callback)
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('removeProjectFromTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.removeProjectFromTag(
          userId,
          tagId,
          projectId,
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        this.request.del
          .calledWith({
            url: `${tagsUrl}/user/${userId}/tag/${tagId}/project/${projectId}`,
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.removeProjectFromTag(
          userId,
          tagId,
          projectId,
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('addProjectToTag', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.addProjectToTag(userId, tagId, projectId, this.callback)
      })

      it('should send a request to the tag backend', function() {
        this.request.post
          .calledWith({
            url: `${tagsUrl}/user/${userId}/tag/${tagId}/project/${projectId}`,
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.addProjectToTag(userId, tagId, projectId, this.callback)
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('addProjectToTagName', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.addProjectToTagName(userId, tag, projectId, this.callback)
      })

      it('should send a request to the tag backend', function() {
        this.request.post
          .calledWith({
            json: {
              name: tag
            },
            url: `${tagsUrl}/user/${userId}/tag/project/${projectId}`,
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.addProjectToTagName(
          userId,
          tagId,
          projectId,
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('updateTagUserIds', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.request.put = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        this.handler.updateTagUserIds(
          'old-user-id',
          'new-user-id',
          this.callback
        )
      })

      it('should send a request to the tag backend', function() {
        this.request.put
          .calledWith({
            json: {
              user_id: 'new-user-id'
            },
            url: `${tagsUrl}/user/old-user-id/tag`,
            timeout: 10000
          })
          .should.equal(true)
      })

      it('should call the callback with no error', function() {
        this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with error', function() {
      beforeEach(function() {
        this.request.put = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        this.handler.updateTagUserIds(
          'old-user-id',
          'new-user-id',
          this.callback
        )
      })

      it('should call the callback with an Error', function() {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })
})
