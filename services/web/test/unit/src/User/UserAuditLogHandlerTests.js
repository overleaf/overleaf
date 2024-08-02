const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const SandboxedModule = require('sandboxed-module')
const { UserAuditLogEntry } = require('../helpers/models/UserAuditLogEntry')

const MODULE_PATH = '../../../../app/src/Features/User/UserAuditLogHandler'

describe('UserAuditLogHandler', function () {
  beforeEach(function () {
    this.userId = new ObjectId()
    this.initiatorId = new ObjectId()
    this.action = {
      operation: 'clear-sessions',
      initiatorId: this.initiatorId,
      info: {
        sessions: [
          {
            ip_address: '0:0:0:0',
            session_created: '2020-07-15T16:07:57.652Z',
          },
        ],
      },
      ip: '0:0:0:0',
    }
    this.UserAuditLogEntryMock = sinon.mock(UserAuditLogEntry)
    this.UserAuditLogHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../models/UserAuditLogEntry': { UserAuditLogEntry },
      },
    })
  })

  afterEach(function () {
    this.UserAuditLogEntryMock.restore()
  })

  describe('addEntry', function () {
    describe('success', function () {
      beforeEach(function () {
        this.dbUpdate = this.UserAuditLogEntryMock.expects('create')
          .chain('exec')
          .resolves({ modifiedCount: 1 })
      })
      it('writes a log', async function () {
        await this.UserAuditLogHandler.promises.addEntry(
          this.userId,
          this.action.operation,
          this.action.initiatorId,
          this.action.ip,
          this.action.info
        )
        this.UserAuditLogEntryMock.verify()
      })

      it('updates the log for password reset operation witout a initiatorId', async function () {
        await expect(
          this.UserAuditLogHandler.promises.addEntry(
            this.userId,
            'reset-password',
            undefined,
            this.action.ip,
            this.action.info
          )
        )
        this.UserAuditLogEntryMock.verify()
      })

      it('updates the log for a email removal via script', async function () {
        await expect(
          this.UserAuditLogHandler.promises.addEntry(
            this.userId,
            'remove-email',
            undefined,
            this.action.ip,
            {
              removedEmail: 'foo',
              script: true,
            }
          )
        )
        this.UserAuditLogEntryMock.verify()
      })

      it('updates the log when no ip address or initiatorId is specified for a group join event', async function () {
        this.UserAuditLogHandler.promises.addEntry(
          this.userId,
          'join-group-subscription',
          undefined,
          undefined,
          {
            subscriptionId: 'foo',
          }
        )
      })
    })

    describe('errors', function () {
      describe('missing parameters', function () {
        it('throws an error when no operation', async function () {
          await expect(
            this.UserAuditLogHandler.promises.addEntry(
              this.userId,
              undefined,
              this.action.initiatorId,
              this.action.ip,
              this.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when no IP and not excempt', async function () {
          await expect(
            this.UserAuditLogHandler.promises.addEntry(
              this.userId,
              this.action.operation,
              this.action.initiatorId,
              undefined,
              this.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when no initiatorId and not a password reset operation', async function () {
          await expect(
            this.UserAuditLogHandler.promises.addEntry(
              this.userId,
              this.action.operation,
              undefined,
              this.action.ip,
              this.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when remove-email is not from a script, but has no initiatorId', async function () {
          await expect(
            this.UserAuditLogHandler.promises.addEntry(
              this.userId,
              'remove-email',
              undefined,
              this.action.ip,
              {
                removedEmail: 'foo',
              }
            )
          ).to.be.rejected
        })
      })
    })
  })
})
