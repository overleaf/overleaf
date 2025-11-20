import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Crypto from 'node:crypto'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter.mjs'

describe('CollaboratorsInviteGetter', function () {
  beforeEach(async function (ctx) {
    ctx.ProjectInvite = class ProjectInvite {
      constructor(options) {
        if (options == null) {
          options = {}
        }
        this._id = new ObjectId()
        for (const k in options) {
          const v = options[k]
          this[k] = v
        }
      }
    }
    ctx.ProjectInvite.prototype.save = sinon.stub()
    ctx.ProjectInvite.findOne = sinon.stub()
    ctx.ProjectInvite.find = sinon.stub()
    ctx.ProjectInvite.deleteOne = sinon.stub()
    ctx.ProjectInvite.findOneAndDelete = sinon.stub()
    ctx.ProjectInvite.countDocuments = sinon.stub()

    ctx.Crypto = {
      randomBytes: sinon.stub().callsFake(Crypto.randomBytes),
    }

    ctx.CollaboratorsInviteHelper = {
      generateToken: sinon.stub().returns(ctx.Crypto.randomBytes(24)),
      hashInviteToken: sinon.stub().returns(ctx.tokenHmac),
    }

    vi.doMock('../../../../app/src/models/ProjectInvite', () => ({
      ProjectInvite: ctx.ProjectInvite,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHelper',
      () => ({
        default: ctx.CollaboratorsInviteHelper,
      })
    )

    ctx.CollaboratorsInviteGetter = (await import(MODULE_PATH)).default

    ctx.projectId = new ObjectId()
    ctx.sendingUserId = new ObjectId()
    ctx.email = 'user@example.com'
    ctx.userId = new ObjectId()
    ctx.inviteId = new ObjectId()
    ctx.token = 'hnhteaosuhtaeosuahs'
    ctx.privileges = 'readAndWrite'
    ctx.fakeInvite = {
      _id: ctx.inviteId,
      email: ctx.email,
      token: ctx.token,
      tokenHmac: ctx.tokenHmac,
      sendingUserId: ctx.sendingUserId,
      projectId: ctx.projectId,
      privileges: ctx.privileges,
      createdAt: new Date(),
    }
  })

  describe('getEditInviteCount', function () {
    beforeEach(function (ctx) {
      ctx.ProjectInvite.countDocuments.returns({
        exec: sinon.stub().resolves(2),
      })
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteGetter.promises.getEditInviteCount(
          ctx.projectId
        )
      }
    })

    it('should produce the count of documents', async function (ctx) {
      const count = await ctx.call()
      expect(ctx.ProjectInvite.countDocuments).to.be.calledWith({
        projectId: ctx.projectId,
        privileges: { $ne: 'readOnly' },
      })
      expect(count).to.equal(2)
    })

    describe('when model.countDocuments produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.countDocuments.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getAllInvites', function () {
    beforeEach(function (ctx) {
      ctx.fakeInvites = [
        { _id: new ObjectId(), one: 1 },
        { _id: new ObjectId(), two: 2 },
      ]
      ctx.ProjectInvite.find.returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(ctx.fakeInvites),
      })
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteGetter.promises.getAllInvites(
          ctx.projectId
        )
      }
    })

    describe('when all goes well', function () {
      beforeEach(function () {})

      it('should produce a list of invite objects', async function (ctx) {
        const invites = await ctx.call()
        expect(invites).to.not.be.oneOf([null, undefined])
        expect(invites).to.deep.equal(ctx.fakeInvites)
      })

      it('should have called ProjectInvite.find', async function (ctx) {
        await ctx.call()
        ctx.ProjectInvite.find.callCount.should.equal(1)
        ctx.ProjectInvite.find
          .calledWith({ projectId: ctx.projectId })
          .should.equal(true)
      })
    })

    describe('when ProjectInvite.find produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.find.returns({
          select: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getInviteByToken', function () {
    beforeEach(function (ctx) {
      ctx.ProjectInvite.findOne.returns({
        exec: sinon.stub().resolves(ctx.fakeInvite),
      })
      ctx.call = async () => {
        return await ctx.CollaboratorsInviteGetter.promises.getInviteByToken(
          ctx.projectId,
          ctx.token
        )
      }
    })

    describe('when all goes well', function () {
      it('should produce the invite object', async function (ctx) {
        const invite = await ctx.call()
        expect(invite).to.deep.equal(ctx.fakeInvite)
      })

      it('should call ProjectInvite.findOne', async function (ctx) {
        await ctx.call()
        ctx.ProjectInvite.findOne.callCount.should.equal(1)
        ctx.ProjectInvite.findOne
          .calledWith({ projectId: ctx.projectId, tokenHmac: ctx.tokenHmac })
          .should.equal(true)
      })
    })

    describe('when findOne produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.findOne.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith(Error)
      })
    })

    describe('when findOne does not find an invite', function () {
      beforeEach(function (ctx) {
        ctx.ProjectInvite.findOne.returns({
          exec: sinon.stub().resolves(null),
        })
      })

      it('should not produce an invite object', async function (ctx) {
        const invite = await ctx.call()
        expect(invite).to.be.oneOf([null, undefined])
      })
    })
  })
})
