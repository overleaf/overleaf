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
    it('should find all the documents with that user id', async function () {
      const stubbedTags = [{ name: 'tag1' }, { name: 'tag2' }, { name: 'tag3' }]
      this.TagMock.expects('find')
        .once()
        .withArgs({ user_id: this.userId })
        .resolves(stubbedTags)
      const result = await this.TagsHandler.promises.getAllTags(this.userId)
      this.TagMock.verify()
      expect(result).to.deep.equal(stubbedTags)
    })
  })

  describe('createTag', function () {
    describe('when insert succeeds', function () {
      it('should call insert in mongo', async function () {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .resolves(this.tag)
        const resultTag = await this.TagsHandler.promises.createTag(
          this.tag.user_id,
          this.tag.name,
          this.tag.color
        )
        this.TagMock.verify()
        expect(resultTag.user_id).to.equal(this.tag.user_id)
        expect(resultTag.name).to.equal(this.tag.name)
        expect(resultTag.color).to.equal(this.tag.color)
      })
    })

    describe('when truncate=true, and tag is too long', function () {
      it('should truncate the tag name', async function () {
        // Expect the tag to end up with this truncated name
        this.tag.name = 'a comically long tag that will be truncated intern'
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .resolves(this.tag)
        const resultTag = await this.TagsHandler.promises.createTag(
          this.tag.user_id,
          // Pass this too-long name
          'a comically long tag that will be truncated internally and not throw an error',
          this.tag.color,
          { truncate: true }
        )
        expect(resultTag.name).to.equal(this.tag.name)
      })
    })

    describe('when tag is too long', function () {
      it('should throw an error', async function () {
        let error

        try {
          await this.TagsHandler.promises.createTag(
            this.tag.user_id,
            'this is a tag that is very very very very very very long',
            undefined
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        expect(error).to.have.property('message', 'Exceeded max tag length')
      })
    })

    describe('when insert has duplicate key error error', function () {
      beforeEach(function () {
        this.duplicateKeyError = new Error('Duplicate')
        this.duplicateKeyError.code = 11000
      })

      it('should get tag with findOne and return that tag', async function () {
        this.TagMock.expects('create')
          .withArgs(this.tag)
          .once()
          .throws(this.duplicateKeyError)
        this.TagMock.expects('findOne')
          .withArgs({ user_id: this.tag.user_id, name: this.tag.name })
          .once()
          .resolves(this.tag)
        const resultTag = await this.TagsHandler.promises.createTag(
          this.tag.user_id,
          this.tag.name,
          this.tag.color
        )
        this.TagMock.verify()
        expect(resultTag.user_id).to.equal(this.tag.user_id)
        expect(resultTag.name).to.equal(this.tag.name)
        expect(resultTag.color).to.equal(this.tag.color)
      })
    })
  })

  describe('addProjectToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function () {
        this.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $addToSet: { project_ids: this.projectId } }
          )
          .resolves()
        await this.TagsHandler.promises.addProjectToTag(
          this.userId,
          this.tagId,
          this.projectId
        )
        this.TagMock.verify()
      })
    })
  })

  describe('addProjectsToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function () {
        this.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $addToSet: { project_ids: { $each: this.projectIds } } }
          )
          .resolves()
        await this.TagsHandler.promises.addProjectsToTag(
          this.userId,
          this.tagId,
          this.projectIds
        )
        this.TagMock.verify()
      })
    })
  })

  describe('addProjectToTagName', function () {
    it('should call update in mongo', async function () {
      this.TagMock.expects('updateOne')
        .once()
        .withArgs(
          { name: this.tag.name, user_id: this.tag.userId },
          { $addToSet: { project_ids: this.projectId } },
          { upsert: true }
        )
        .resolves()
      await this.TagsHandler.promises.addProjectToTagName(
        this.tag.userId,
        this.tag.name,
        this.projectId
      )
      this.TagMock.verify()
    })
  })

  describe('removeProjectFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function () {
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
        await this.TagsHandler.promises.removeProjectFromTag(
          this.userId,
          this.tagId,
          this.projectId
        )

        this.TagMock.verify()
      })
    })
  })

  describe('removeProjectsFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function () {
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
        await this.TagsHandler.promises.removeProjectsFromTag(
          this.userId,
          this.tagId,
          this.projectIds
        )
        this.TagMock.verify()
      })
    })
  })

  describe('removeProjectFromAllTags', function () {
    it('should pull the project id from the tag', async function () {
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
      await this.TagsHandler.promises.removeProjectFromAllTags(
        this.userId,
        this.projectId
      )
      this.TagMock.verify()
    })
  })

  describe('addProjectToTags', function () {
    it('should add the project id to each tag', async function () {
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
      await this.TagsHandler.promises.addProjectToTags(
        this.userId,
        tagIds,
        this.projectId
      )
      this.TagMock.verify()
    })
  })

  describe('deleteTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', async function () {
        this.TagMock.expects('deleteOne')
          .once()
          .withArgs({ _id: this.tagId, user_id: this.userId })
          .resolves()
        await this.TagsHandler.promises.deleteTag(this.userId, this.tagId)
        this.TagMock.verify()
      })
    })
  })

  describe('renameTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', async function () {
        this.newName = 'new name'
        this.TagMock.expects('updateOne')
          .once()
          .withArgs(
            { _id: this.tagId, user_id: this.userId },
            { $set: { name: this.newName } }
          )
          .resolves()
        await this.TagsHandler.promises.renameTag(
          this.userId,
          this.tagId,
          this.newName
        )
        this.TagMock.verify()
      })
    })

    describe('when tag is too long', function () {
      it('should throw an error', async function () {
        let error

        try {
          await this.TagsHandler.promises.renameTag(
            this.userId,
            this.tagId,
            'this is a tag that is very very very very very very long'
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        expect(error).to.have.property('message', 'Exceeded max tag length')
      })
    })
  })
})
