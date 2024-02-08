const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalHandler.js'
)

describe('Referal handler', function () {
  beforeEach(function () {
    this.User = {
      findById: sinon.stub().returns({
        exec: sinon.stub(),
      }),
    }
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: this.User,
        },
      },
    })
    this.user_id = '12313'
  })

  describe('getting refered user_ids', function () {
    it('should get the user from mongo and return the refered users array', async function () {
      const user = {
        refered_users: ['1234', '312312', '3213129'],
        refered_user_count: 3,
      }
      this.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const {
        referedUsers: passedReferedUserIds,
        referedUserCount: passedReferedUserCount,
      } = await this.handler.promises.getReferedUsers(this.user_id)

      passedReferedUserIds.should.deep.equal(user.refered_users)
      passedReferedUserCount.should.equal(3)
    })

    it('should return an empty array if it is not set', async function () {
      const user = {}
      this.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUsers: passedReferedUserIds } =
        await this.handler.promises.getReferedUsers(this.user_id)

      passedReferedUserIds.length.should.equal(0)
    })

    it('should return a zero count if neither it or the array are set', async function () {
      const user = {}
      this.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUserCount: passedReferedUserCount } =
        await this.handler.promises.getReferedUsers(this.user_id)

      passedReferedUserCount.should.equal(0)
    })

    it('should return the array length if count is not set', async function () {
      const user = { refered_users: ['1234', '312312', '3213129'] }
      this.User.findById.returns({
        exec: sinon.stub().resolves(user),
      })

      const { referedUserCount: passedReferedUserCount } =
        await this.handler.promises.getReferedUsers(this.user_id)

      passedReferedUserCount.should.equal(3)
    })

    it('should error if finding the user fails', async function () {
      this.User.findById.returns({
        exec: sinon.stub().rejects(new Error('user not found')),
      })

      expect(
        this.handler.promises.getReferedUsers(this.user_id)
      ).to.be.rejectedWith('user not found')
    })
  })
})
