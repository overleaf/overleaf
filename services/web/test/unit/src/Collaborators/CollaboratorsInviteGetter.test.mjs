const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const Crypto = require('crypto')

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter.js'

describe('CollaboratorsInviteGetter', function () {
  beforeEach(function () {
    this.ProjectInvite = class ProjectInvite {
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
    this.ProjectInvite.prototype.save = sinon.stub()
    this.ProjectInvite.findOne = sinon.stub()
    this.ProjectInvite.find = sinon.stub()
    this.ProjectInvite.deleteOne = sinon.stub()
    this.ProjectInvite.findOneAndDelete = sinon.stub()
    this.ProjectInvite.countDocuments = sinon.stub()

    this.Crypto = {
      randomBytes: sinon.stub().callsFake(Crypto.randomBytes),
    }

    this.CollaboratorsInviteHelper = {
      generateToken: sinon.stub().returns(this.Crypto.randomBytes(24)),
      hashInviteToken: sinon.stub().returns(this.tokenHmac),
    }

    this.CollaboratorsInviteGetter = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../models/ProjectInvite': { ProjectInvite: this.ProjectInvite },
        './CollaboratorsInviteHelper': this.CollaboratorsInviteHelper,
      },
    })

    this.projectId = new ObjectId()
    this.sendingUserId = new ObjectId()
    this.email = 'user@example.com'
    this.userId = new ObjectId()
    this.inviteId = new ObjectId()
    this.token = 'hnhteaosuhtaeosuahs'
    this.privileges = 'readAndWrite'
    this.fakeInvite = {
      _id: this.inviteId,
      email: this.email,
      token: this.token,
      tokenHmac: this.tokenHmac,
      sendingUserId: this.sendingUserId,
      projectId: this.projectId,
      privileges: this.privileges,
      createdAt: new Date(),
    }
  })

  describe('getEditInviteCount', function () {
    beforeEach(function () {
      this.ProjectInvite.countDocuments.returns({
        exec: sinon.stub().resolves(2),
      })
      this.call = async () => {
        return await this.CollaboratorsInviteGetter.promises.getEditInviteCount(
          this.projectId
        )
      }
    })

    it('should produce the count of documents', async function () {
      const count = await this.call()
      expect(this.ProjectInvite.countDocuments).to.be.calledWith({
        projectId: this.projectId,
        privileges: { $ne: 'readOnly' },
      })
      expect(count).to.equal(2)
    })

    describe('when model.countDocuments produces an error', function () {
      beforeEach(function () {
        this.ProjectInvite.countDocuments.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getAllInvites', function () {
    beforeEach(function () {
      this.fakeInvites = [
        { _id: new ObjectId(), one: 1 },
        { _id: new ObjectId(), two: 2 },
      ]
      this.ProjectInvite.find.returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(this.fakeInvites),
      })
      this.call = async () => {
        return await this.CollaboratorsInviteGetter.promises.getAllInvites(
          this.projectId
        )
      }
    })

    describe('when all goes well', function () {
      beforeEach(function () {})

      it('should produce a list of invite objects', async function () {
        const invites = await this.call()
        expect(invites).to.not.be.oneOf([null, undefined])
        expect(invites).to.deep.equal(this.fakeInvites)
      })

      it('should have called ProjectInvite.find', async function () {
        await this.call()
        this.ProjectInvite.find.callCount.should.equal(1)
        this.ProjectInvite.find
          .calledWith({ projectId: this.projectId })
          .should.equal(true)
      })
    })

    describe('when ProjectInvite.find produces an error', function () {
      beforeEach(function () {
        this.ProjectInvite.find.returns({
          select: sinon.stub().returnsThis(),
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getInviteByToken', function () {
    beforeEach(function () {
      this.ProjectInvite.findOne.returns({
        exec: sinon.stub().resolves(this.fakeInvite),
      })
      this.call = async () => {
        return await this.CollaboratorsInviteGetter.promises.getInviteByToken(
          this.projectId,
          this.token
        )
      }
    })

    describe('when all goes well', function () {
      it('should produce the invite object', async function () {
        const invite = await this.call()
        expect(invite).to.deep.equal(this.fakeInvite)
      })

      it('should call ProjectInvite.findOne', async function () {
        await this.call()
        this.ProjectInvite.findOne.callCount.should.equal(1)
        this.ProjectInvite.findOne
          .calledWith({ projectId: this.projectId, tokenHmac: this.tokenHmac })
          .should.equal(true)
      })
    })

    describe('when findOne produces an error', function () {
      beforeEach(function () {
        this.ProjectInvite.findOne.returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith(Error)
      })
    })

    describe('when findOne does not find an invite', function () {
      beforeEach(function () {
        this.ProjectInvite.findOne.returns({
          exec: sinon.stub().resolves(null),
        })
      })

      it('should not produce an invite object', async function () {
        const invite = await this.call()
        expect(invite).to.be.oneOf([null, undefined])
      })
    })
  })
})
