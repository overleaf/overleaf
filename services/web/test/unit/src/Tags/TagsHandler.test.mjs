import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import path from 'node:path'
import { Tag } from '../../../../app/src/models/Tag.mjs'
const { ObjectId } = mongodb

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Tags/TagsHandler.mjs'
)

describe('TagsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId().toString()
    ctx.callback = sinon.stub()

    ctx.tag = { user_id: ctx.userId, name: 'some name', color: '#3399CC' }
    ctx.tagId = new ObjectId().toString()
    ctx.projectId = new ObjectId().toString()
    ctx.projectIds = [new ObjectId().toString(), new ObjectId().toString()]

    ctx.mongodb = { ObjectId }
    ctx.TagMock = sinon.mock(Tag)

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      default: ctx.mongodb,
    }))

    vi.doMock('../../../../app/src/models/Tag', () => ({
      Tag,
    }))

    ctx.TagsHandler = (await import(modulePath)).default
  })

  describe('finding users tags', function () {
    it('should find all the documents with that user id', async function (ctx) {
      const stubbedTags = [{ name: 'tag1' }, { name: 'tag2' }, { name: 'tag3' }]
      ctx.TagMock.expects('find')
        .once()
        .withArgs({ user_id: ctx.userId })
        .resolves(stubbedTags)
      const result = await ctx.TagsHandler.promises.getAllTags(ctx.userId)
      ctx.TagMock.verify()
      expect(result).to.deep.equal(stubbedTags)
    })
  })

  describe('createTag', function () {
    describe('when insert succeeds', function () {
      it('should call insert in mongo', async function (ctx) {
        ctx.TagMock.expects('create').withArgs(ctx.tag).once().resolves(ctx.tag)
        const resultTag = await ctx.TagsHandler.promises.createTag(
          ctx.tag.user_id,
          ctx.tag.name,
          ctx.tag.color
        )
        ctx.TagMock.verify()
        expect(resultTag.user_id).to.equal(ctx.tag.user_id)
        expect(resultTag.name).to.equal(ctx.tag.name)
        expect(resultTag.color).to.equal(ctx.tag.color)
      })
    })

    describe('when truncate=true, and tag is too long', function () {
      it('should truncate the tag name', async function (ctx) {
        // Expect the tag to end up with this truncated name
        ctx.tag.name = 'a comically long tag that will be truncated intern'
        ctx.TagMock.expects('create').withArgs(ctx.tag).once().resolves(ctx.tag)
        const resultTag = await ctx.TagsHandler.promises.createTag(
          ctx.tag.user_id,
          // Pass this too-long name
          'a comically long tag that will be truncated internally and not throw an error',
          ctx.tag.color,
          { truncate: true }
        )
        expect(resultTag.name).to.equal(ctx.tag.name)
      })
    })

    describe('when tag is too long', function () {
      it('should throw an error', async function (ctx) {
        let error

        try {
          await ctx.TagsHandler.promises.createTag(
            ctx.tag.user_id,
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
      beforeEach(function (ctx) {
        ctx.duplicateKeyError = new Error('Duplicate')
        ctx.duplicateKeyError.code = 11000
      })

      it('should get tag with findOne and return that tag', async function (ctx) {
        ctx.TagMock.expects('create')
          .withArgs(ctx.tag)
          .once()
          .throws(ctx.duplicateKeyError)
        ctx.TagMock.expects('findOne')
          .withArgs({ user_id: ctx.tag.user_id, name: ctx.tag.name })
          .once()
          .resolves(ctx.tag)
        const resultTag = await ctx.TagsHandler.promises.createTag(
          ctx.tag.user_id,
          ctx.tag.name,
          ctx.tag.color
        )
        ctx.TagMock.verify()
        expect(resultTag.user_id).to.equal(ctx.tag.user_id)
        expect(resultTag.name).to.equal(ctx.tag.name)
        expect(resultTag.color).to.equal(ctx.tag.color)
      })
    })
  })

  describe('addProjectToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function (ctx) {
        ctx.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: ctx.tagId, user_id: ctx.userId },
            { $addToSet: { project_ids: ctx.projectId } }
          )
          .resolves()
        await ctx.TagsHandler.promises.addProjectToTag(
          ctx.userId,
          ctx.tagId,
          ctx.projectId
        )
        ctx.TagMock.verify()
      })
    })
  })

  describe('addProjectsToTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function (ctx) {
        ctx.TagMock.expects('findOneAndUpdate')
          .once()
          .withArgs(
            { _id: ctx.tagId, user_id: ctx.userId },
            { $addToSet: { project_ids: { $each: ctx.projectIds } } }
          )
          .resolves()
        await ctx.TagsHandler.promises.addProjectsToTag(
          ctx.userId,
          ctx.tagId,
          ctx.projectIds
        )
        ctx.TagMock.verify()
      })
    })
  })

  describe('addProjectToTagName', function () {
    it('should call update in mongo', async function (ctx) {
      ctx.TagMock.expects('updateOne')
        .once()
        .withArgs(
          { name: ctx.tag.name, user_id: ctx.tag.userId },
          { $addToSet: { project_ids: ctx.projectId } },
          { upsert: true }
        )
        .resolves()
      await ctx.TagsHandler.promises.addProjectToTagName(
        ctx.tag.userId,
        ctx.tag.name,
        ctx.projectId
      )
      ctx.TagMock.verify()
    })
  })

  describe('removeProjectFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function (ctx) {
        ctx.TagMock.expects('updateOne')
          .once()
          .withArgs(
            {
              _id: ctx.tagId,
              user_id: ctx.userId,
            },
            {
              $pull: { project_ids: ctx.projectId },
            }
          )
          .resolves()
        await ctx.TagsHandler.promises.removeProjectFromTag(
          ctx.userId,
          ctx.tagId,
          ctx.projectId
        )

        ctx.TagMock.verify()
      })
    })
  })

  describe('removeProjectsFromTag', function () {
    describe('with a valid tag_id', function () {
      it('should call update in mongo', async function (ctx) {
        ctx.TagMock.expects('updateOne')
          .once()
          .withArgs(
            {
              _id: ctx.tagId,
              user_id: ctx.userId,
            },
            {
              $pullAll: { project_ids: ctx.projectIds },
            }
          )
          .resolves()
        await ctx.TagsHandler.promises.removeProjectsFromTag(
          ctx.userId,
          ctx.tagId,
          ctx.projectIds
        )
        ctx.TagMock.verify()
      })
    })
  })

  describe('removeProjectFromAllTags', function () {
    it('should pull the project id from the tag', async function (ctx) {
      ctx.TagMock.expects('updateMany')
        .once()
        .withArgs(
          {
            user_id: ctx.userId,
          },
          {
            $pull: { project_ids: ctx.projectId },
          }
        )
        .resolves()
      await ctx.TagsHandler.promises.removeProjectFromAllTags(
        ctx.userId,
        ctx.projectId
      )
      ctx.TagMock.verify()
    })
  })

  describe('addProjectToTags', function () {
    it('should add the project id to each tag', async function (ctx) {
      const tagIds = []

      ctx.TagMock.expects('updateMany')
        .once()
        .withArgs(
          {
            user_id: ctx.userId,
            _id: { $in: tagIds },
          },
          {
            $addToSet: { project_ids: ctx.projectId },
          }
        )
        .resolves()
      await ctx.TagsHandler.promises.addProjectToTags(
        ctx.userId,
        tagIds,
        ctx.projectId
      )
      ctx.TagMock.verify()
    })
  })

  describe('deleteTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', async function (ctx) {
        ctx.TagMock.expects('deleteOne')
          .once()
          .withArgs({ _id: ctx.tagId, user_id: ctx.userId })
          .resolves()
        await ctx.TagsHandler.promises.deleteTag(ctx.userId, ctx.tagId)
        ctx.TagMock.verify()
      })
    })
  })

  describe('renameTag', function () {
    describe('with a valid tag_id', function () {
      it('should call remove in mongo', async function (ctx) {
        ctx.newName = 'new name'
        ctx.TagMock.expects('updateOne')
          .once()
          .withArgs(
            { _id: ctx.tagId, user_id: ctx.userId },
            { $set: { name: ctx.newName } }
          )
          .resolves()
        await ctx.TagsHandler.promises.renameTag(
          ctx.userId,
          ctx.tagId,
          ctx.newName
        )
        ctx.TagMock.verify()
      })
    })

    describe('when tag is too long', function () {
      it('should throw an error', async function (ctx) {
        let error

        try {
          await ctx.TagsHandler.promises.renameTag(
            ctx.userId,
            ctx.tagId,
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
