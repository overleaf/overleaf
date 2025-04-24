const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Cooldown/CooldownManager'
)

describe('CooldownManager', function () {
  beforeEach(function () {
    this.projectId = 'abcdefg'
    this.rclient = { set: sinon.stub(), get: sinon.stub() }
    this.RedisWrapper = { client: () => this.rclient }
    this.CooldownManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/RedisWrapper': this.RedisWrapper,
      },
    })
  })

  describe('_buildKey', function () {
    it('should build a properly formatted redis key', function () {
      expect(this.CooldownManager._buildKey('ABC')).to.equal('Cooldown:{ABC}')
    })
  })

  describe('isProjectOnCooldown', function () {
    describe('when project is on cooldown', function () {
      beforeEach(function () {
        this.rclient.get = sinon.stub().callsArgWith(1, null, '1')
      })

      it('should fetch key from redis', async function () {
        await this.CooldownManager.promises.isProjectOnCooldown(this.projectId)
        this.rclient.get.callCount.should.equal(1)
        this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
      })

      it('should produce a true result', async function () {
        const result = await this.CooldownManager.promises.isProjectOnCooldown(
          this.projectId
        )
        expect(result).to.equal(true)
      })
    })

    describe('when project is not on cooldown', function () {
      beforeEach(function () {
        this.rclient.get = sinon.stub().callsArgWith(1, null, null)
      })

      it('should fetch key from redis', async function () {
        await this.CooldownManager.promises.isProjectOnCooldown(this.projectId)
        this.rclient.get.callCount.should.equal(1)
        this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
      })

      it('should produce a false result', async function () {
        const result = await this.CooldownManager.promises.isProjectOnCooldown(
          this.projectId
        )
        expect(result).to.equal(false)
      })
    })

    describe('when rclient.get produces an error', function () {
      beforeEach(function () {
        this.rclient.get = sinon.stub().callsArgWith(1, new Error('woops'))
      })

      it('should fetch key from redis', async function () {
        try {
          await this.CooldownManager.promises.isProjectOnCooldown(
            this.projectId
          )
        } catch {
          // ignore errors - expected
        }
        this.rclient.get.callCount.should.equal(1)
        this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
      })

      it('should produce an error', async function () {
        let error

        try {
          await this.CooldownManager.promises.isProjectOnCooldown(
            this.projectId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })
  })

  describe('putProjectOnCooldown', function () {
    describe('when rclient.set does not produce an error', function () {
      beforeEach(function () {
        this.rclient.set = sinon.stub().callsArgWith(4, null)
      })

      it('should set a key in redis', async function () {
        await this.CooldownManager.promises.putProjectOnCooldown(this.projectId)
        this.rclient.set.callCount.should.equal(1)
        this.rclient.set.calledWith('Cooldown:{abcdefg}').should.equal(true)
      })

      it('should not produce an error', async function () {
        let error
        try {
          await this.CooldownManager.promises.putProjectOnCooldown(
            this.projectId
          )
        } catch (err) {
          error = err
        }
        expect(error).not.to.exist
      })
    })

    describe('when rclient.set produces an error', function () {
      beforeEach(function () {
        this.rclient.set = sinon.stub().callsArgWith(4, new Error('woops'))
      })

      it('should set a key in redis', async function () {
        try {
          await this.CooldownManager.promises.putProjectOnCooldown(
            this.projectId
          )
        } catch {
          // ignore errors - expected
        }
        this.rclient.set.callCount.should.equal(1)
        this.rclient.set.calledWith('Cooldown:{abcdefg}').should.equal(true)
      })

      it('produce an error', async function () {
        let error
        try {
          await this.CooldownManager.promises.putProjectOnCooldown(
            this.projectId
          )
        } catch (err) {
          error = err
        }
        expect(error).to.be.instanceOf(Error)
      })
    })
  })
})
