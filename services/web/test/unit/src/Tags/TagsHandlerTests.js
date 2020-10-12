const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
require('chai').should()
const sinon = require('sinon')
const { Tag } = require('../helpers/models/Tag')
const { ObjectId } = require('mongodb')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsHandler.js'
)

describe('TagsHandler', function() {
  beforeEach(function() {
    this.userId = ObjectId().toString()
    this.callback = sinon.stub()

    this.tag = { user_id: this.userId, name: 'some name' }
    this.tagId = ObjectId().toString()
    this.projectId = ObjectId().toString()

    this.mongodb = { ObjectId: ObjectId }
    this.TagMock = sinon.mock(Tag)

    this.TagsHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': this.mongodb,
        '../../models/Tag': { Tag: Tag }
      }
    })
  })

  describe('finding users tags', function() {
    it('should find all the documents with that user id', function(done) {
      const stubbedTags = [{ name: 'tag1' }, { name: 'tag2' }, { name: 'tag3' }]
      this.TagMock.expects('find')
        .once()
        .withArgs({ user_id: this.userId })
        .yields(null, stubbedTags)
      this.TagsHandler.getAllTags(this.userId, (err, result) => {
        expect(err).to.not.exist
        this.TagMock.verify()
        expect(result).to.deep.equal(stubbedTags)
        done()
      })
    })
  })

  describe('createTag', function() {
    describe('when insert succeeds', function() {
      it('should call insert in mongo', function(done) {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .yields(null, this.tag)
        this.TagsHandler.createTag(
          this.tag.user_id,
          this.tag.name,
          (err, resultTag) => {
            expect(err).to.not.exist
            this.TagMock.verify()
            expect(resultTag.user_id).to.equal(this.tag.user_id)
            expect(resultTag.name).to.equal(this.tag.name)
            done()
          }
        )
      })
    })

    describe('when insert has duplicate key error error', function() {
      beforeEach(function() {
        this.duplicateKeyError = new Error('Duplicate')
        this.duplicateKeyError.code = 11000
      })

      it('should get tag with findOne and return that tag', function(done) {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .yields(this.duplicateKeyError)
        this.TagMock.expects('findOne')
          .withArgs({ user_id: this.tag.user_id, name: this.tag.name })
          .once()
          .yields(null, this.tag)
        this.TagsHandler.createTag(
          this.tag.user_id,
          this.tag.name,
          (err, resultTag) => {
            expect(err).to.not.exist
            this.TagMock.verify()
            expect(resultTag.user_id).to.equal(this.tag.user_id)
            expect(resultTag.name).to.equal(this.tag.name)
            done()
          }
        )
      })
    })
  })

  describe('addProjectToTag', function() {
    describe('with a valid tag_id', function() {
      beforeEach(function() {})

      it('should call update in mongo', function(done) {
        this.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $addToSet: { project_ids: this.projectId } }
          )
          .yields()
        this.TagsHandler.addProjectToTag(
          this.userId,
          this.tagId,
          this.projectId,
          err => {
            expect(err).to.not.exist
            this.TagMock.verify()
            done()
          }
        )
      })
    })
  })

  describe('addProjectToTagName', function() {
    it('should call update in mongo', function(done) {
      this.TagMock.expects('update')
        .once()
        .withArgs(
          { name: this.tag.name, user_id: this.tag.userId },
          { $addToSet: { project_ids: this.projectId } },
          { upsert: true }
        )
        .yields()
      this.TagsHandler.addProjectToTagName(
        this.tag.userId,
        this.tag.name,
        this.projectId,
        err => {
          expect(err).to.not.exist
          this.TagMock.verify()
          done()
        }
      )
    })
  })

  describe('updateTagUserIds', function() {
    it('should call update in mongo', function(done) {
      this.newUserId = ObjectId().toString()
      this.TagMock.expects('update')
        .once()
        .withArgs(
          { user_id: this.userId },
          { $set: { user_id: this.newUserId } },
          { multi: true }
        )
        .yields()
      this.TagsHandler.updateTagUserIds(this.userId, this.newUserId, err => {
        expect(err).to.not.exist
        this.TagMock.verify()
        done()
      })
    })
  })

  describe('removeProjectFromTag', function() {
    describe('with a valid tag_id', function() {
      it('should call update in mongo', function(done) {
        this.TagMock.expects('update')
          .once()
          .withArgs(
            {
              _id: this.tagId,
              user_id: this.userId
            },
            {
              $pull: { project_ids: this.projectId }
            }
          )
          .yields()
        this.TagsHandler.removeProjectFromTag(
          this.userId,
          this.tagId,
          this.projectId,
          err => {
            expect(err).to.not.exist
            this.TagMock.verify()
            done()
          }
        )
      })
    })
  })

  describe('removeProjectFromAllTags', function() {
    it('should pull the project id from the tag', function(done) {
      this.TagMock.expects('update')
        .once()
        .withArgs(
          {
            user_id: this.userId
          },
          {
            $pull: { project_ids: this.projectId }
          }
        )
        .yields()
      this.TagsHandler.removeProjectFromAllTags(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          this.TagMock.verify()
          done()
        }
      )
    })
  })

  describe('deleteTag', function() {
    describe('with a valid tag_id', function() {
      it('should call remove in mongo', function(done) {
        this.TagMock.expects('remove')
          .once()
          .withArgs({ _id: this.tagId, user_id: this.userId })
          .yields()
        this.TagsHandler.deleteTag(this.userId, this.tagId, err => {
          expect(err).to.not.exist
          this.TagMock.verify()
          done()
        })
      })
    })
  })

  describe('renameTag', function() {
    describe('with a valid tag_id', function() {
      it('should call remove in mongo', function(done) {
        this.newName = 'new name'
        this.TagMock.expects('update')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $set: { name: this.newName } }
          )
          .yields()
        this.TagsHandler.renameTag(
          this.userId,
          this.tagId,
          this.newName,
          err => {
            expect(err).to.not.exist
            this.TagMock.verify()
            done()
          }
        )
      })
    })
  })
})
