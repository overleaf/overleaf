const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const { Tag } = require('../helpers/models/Tag')
const { ObjectId } = require('mongodb-legacy')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsHandler.js'
)

describe('TagsHandler', function () {
  beforeEach(function () {
    this.userId = new ObjectId().toString()
    this.callback = sinon.stub()

    this.tag = { user_id: this.userId, name: 'some name', color: '#3399CC' }
    this.tagId = new ObjectId().toString()
    this.projectId = new ObjectId().toString()
    this.projectIds = [new ObjectId().toString(), new ObjectId().toString()]

    this.mongodb = { ObjectId }
    this.TagMock = sinon.mock(Tag)

    this.TagsHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': this.mongodb,
        '../../models/Tag': { Tag },
      },
    })
  })

  describe('finding users tags', function () {
    it('should find all the documents with that user id', function (done) {
      const stubbedTags = [{ name: 'tag1' }, { name: 'tag2' }, { name: 'tag3' }]
      this.TagMock.expects('find')
        .once()
        .withArgs({ user_id: this.userId })
        .resolves(stubbedTags)
      this.TagsHandler.getAllTags(this.userId, (err, result) => {
        expect(err).to.not.exist
        this.TagMock.verify()
        expect(result).to.deep.equal(stubbedTags)
        done()
      })
    })
  })

  describe('createTag', function () {
    describe('when insert succeeds', function () {
      it('should call insert in mongo', function (done) {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .resolves(this.tag)
        this.TagsHandler.createTag(
          this.tag.user_id,
          this.tag.name,
          this.tag.color,
          (err, resultTag) => {
            expect(err).to.not.exist
            this.TagMock.verify()
            expect(resultTag.user_id).to.equal(this.tag.user_id)
            expect(resultTag.name).to.equal(this.tag.name)
            expect(resultTag.color).to.equal(this.tag.color)
            done()
          }
        )
      })
    })

    describe('when truncate=true, and tag is too long', function () {
      it('should truncate the tag name', function (done) {
        // Expect the tag to end up with this truncated name
        this.tag.name = 'a comically long tag that will be truncated intern'
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .resolves(this.tag)
        this.TagsHandler.createTag(
          this.tag.user_id,
          // Pass this too-long name
          'a comically long tag that will be truncated internally and not throw an error',
          this.tag.color,
          { truncate: true },
          (err, resultTag) => {
            expect(err).to.not.exist
            expect(resultTag.name).to.equal(this.tag.name)
            done()
          }
        )
      })
    })

    describe('when tag is too long', function () {
      it('should throw an error', function (done) {
        this.TagsHandler.createTag(
          this.tag.user_id,
          'this is a tag that is very very very very very very long',
          undefined,
          err => {
            expect(err.message).to.equal('Exceeded max tag length')
            done()
          }
        )
      })
    })

    describe('when insert has duplicate key error error', function () {
      beforeEach(function () {
        this.duplicateKeyError = new Error('Duplicate')
        this.duplicateKeyError.code = 11000
      })

      it('should get tag with findOne and return that tag', function (done) {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .throws(this.duplicateKeyError)
        this.TagMock.expects('findOne')
          .withArgs({ user_id: this.tag.user_id, name: this.tag.name })
          .once()
          .resolves(this.tag)
        this.TagsHandler.createTag(
          this.tag.user_id,
          this.tag.name,
          this.tag.color,
          (err, resultTag) => {
            expect(err).to.not.exist
            this.TagMock.verify()
            expect(resultTag.user_id).to.equal(this.tag.user_id)
            expect(resultTag.name).to.equal(this.tag.name)
            expect(resultTag.color).to.equal(this.tag.color)
            done()
          }
        )
      })
    })
  })

  describe('addProjectToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', function (done) {
        this.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $addToSet: { project_ids: this.projectId } }
          )
          .resolves()
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

  describe('addProjectsToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', function (done) {
        this.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $addToSet: { project_ids: { $each: this.projectIds } } }
          )
          .resolves()
        this.TagsHandler.addProjectsToTag(
          this.userId,
          this.tagId,
          this.projectIds,
          err => {
            expect(err).to.not.exist
            this.TagMock.verify()
            done()
          }
        )
      })
    })
  })

  describe('addProjectToTagName', function () {
    it('should call update in mongo', function (done) {
      this.TagMock.expects('updateOne')
        .once()
        .withArgs(
          { name: this.tag.name, user_id: this.tag.userId },
          { $addToSet: { project_ids: this.projectId } },
          { upsert: true }
        )
        .resolves()
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

  describe('removeProjectFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', function (done) {
        this.TagMock.expects('updateOne')
          .once()
          .withArgs(
            {
              _id: this.tagId,
              user_id: this.userId,
            },
            {
              $pull: { project_ids: this.projectId },
            }
          )
          .resolves()
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

  describe('removeProjectsFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', function (done) {
        this.TagMock.expects('updateOne')
          .once()
          .withArgs(
            {
              _id: this.tagId,
              user_id: this.userId,
            },
            {
              $pullAll: { project_ids: this.projectIds },
            }
          )
          .resolves()
        this.TagsHandler.removeProjectsFromTag(
          this.userId,
          this.tagId,
          this.projectIds,
          err => {
            expect(err).to.not.exist
            this.TagMock.verify()
            done()
          }
        )
      })
    })
  })

  describe('removeProjectFromAllTags', function () {
    it('should pull the project id from the tag', function (done) {
      this.TagMock.expects('updateMany')
        .once()
        .withArgs(
          {
            user_id: this.userId,
          },
          {
            $pull: { project_ids: this.projectId },
          }
        )
        .resolves()
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

  describe('addProjectToTags', function () {
    it('should add the project id to each tag', function (done) {
      const tagIds = []

      this.TagMock.expects('updateMany')
        .once()
        .withArgs(
          {
            user_id: this.userId,
            _id: { $in: tagIds },
          },
          {
            $addToSet: { project_ids: this.projectId },
          }
        )
        .resolves()
      this.TagsHandler.addProjectToTags(
        this.userId,
        tagIds,
        this.projectId,
        (err, result) => {
          expect(err).to.not.exist
          this.TagMock.verify()
          done()
        }
      )
    })
  })

  describe('deleteTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', function (done) {
        this.TagMock.expects('deleteOne')
          .once()
          .withArgs({ _id: this.tagId, user_id: this.userId })
          .resolves()
        this.TagsHandler.deleteTag(this.userId, this.tagId, err => {
          expect(err).to.not.exist
          this.TagMock.verify()
          done()
        })
      })
    })
  })

  describe('renameTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', function (done) {
        this.newName = 'new name'
        this.TagMock.expects('updateOne')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $set: { name: this.newName } }
          )
          .resolves()
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

    describe('when tag is too long', function () {
      it('should throw an error', function (done) {
        this.TagsHandler.renameTag(
          this.userId,
          this.tagId,
          'this is a tag that is very very very very very very long',
          err => {
            expect(err.message).to.equal('Exceeded max tag length')
            done()
          }
        )
      })
    })
  })
})
