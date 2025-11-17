import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { UserAuditLogEntry } from '../../../../app/src/models/UserAuditLogEntry.mjs'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/User/UserAuditLogHandler'

describe('UserAuditLogHandler', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId()
    ctx.initiatorId = new ObjectId()
    ctx.subscriptionId = new ObjectId()
    ctx.action = {
      operation: 'clear-sessions',
      initiatorId: ctx.initiatorId,
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
    ctx.UserAuditLogEntryMock = sinon.mock(UserAuditLogEntry)
    ctx.getUniqueManagedSubscriptionMemberOfMock = sinon.stub().resolves()
    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: {
          promises: {
            getUniqueManagedSubscriptionMemberOf:
              ctx.getUniqueManagedSubscriptionMemberOfMock,
          },
        },
      })
    )

    vi.doMock('../../../../app/src/models/UserAuditLogEntry', () => ({
      UserAuditLogEntry,
    }))

    ctx.UserAuditLogHandler = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.UserAuditLogEntryMock.restore()
  })

  describe('addEntry', function () {
    describe('success', function () {
      beforeEach(function (ctx) {
        ctx.dbUpdate = ctx.UserAuditLogEntryMock.expects('create')
          .chain('exec')
          .resolves({ modifiedCount: 1 })
      })
      it('writes a log', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          ctx.action.operation,
          ctx.action.initiatorId,
          ctx.action.ip,
          ctx.action.info
        )
        ctx.UserAuditLogEntryMock.verify()
      })

      it('updates the log for password reset operation without a initiatorId', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          'reset-password',
          undefined,
          ctx.action.ip,
          ctx.action.info
        )
        ctx.UserAuditLogEntryMock.verify()
      })

      it('updates the log for a email removal via script', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          'remove-email',
          undefined,
          ctx.action.ip,
          {
            removedEmail: 'foo',
            script: true,
          }
        )
        ctx.UserAuditLogEntryMock.verify()
      })

      it('updates the log when no ip address or initiatorId is specified for a group join event', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          'join-group-subscription',
          undefined,
          undefined,
          {
            subscriptionId: 'foo',
          }
        )
        ctx.UserAuditLogEntryMock.verify()
      })

      it('includes managedSubscriptionId for managed group user events ', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          'reset-password',
          undefined,
          ctx.action.ip
        )
        ctx.UserAuditLogEntryMock.verify()
        expect(ctx.getUniqueManagedSubscriptionMemberOfMock).to.have.been.called
      })

      it('does not includes managedSubscriptionId for events not in the managed group event list', async function (ctx) {
        await ctx.UserAuditLogHandler.promises.addEntry(
          ctx.userId,
          'foo',
          ctx.action.initiatorId,
          ctx.action.ip
        )
        ctx.UserAuditLogEntryMock.verify()
        expect(ctx.getUniqueManagedSubscriptionMemberOfMock).not.to.have.been
          .called
      })
    })

    describe('errors', function () {
      describe('missing parameters', function () {
        it('throws an error when no operation', async function (ctx) {
          await expect(
            ctx.UserAuditLogHandler.promises.addEntry(
              ctx.userId,
              undefined,
              ctx.action.initiatorId,
              ctx.action.ip,
              ctx.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when no IP and not excempt', async function (ctx) {
          await expect(
            ctx.UserAuditLogHandler.promises.addEntry(
              ctx.userId,
              ctx.action.operation,
              ctx.action.initiatorId,
              undefined,
              ctx.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when no initiatorId and not a password reset operation', async function (ctx) {
          await expect(
            ctx.UserAuditLogHandler.promises.addEntry(
              ctx.userId,
              ctx.action.operation,
              undefined,
              ctx.action.ip,
              ctx.action.info
            )
          ).to.be.rejected
        })

        it('throws an error when remove-email is not from a script, but has no initiatorId', async function (ctx) {
          await expect(
            ctx.UserAuditLogHandler.promises.addEntry(
              ctx.userId,
              'remove-email',
              undefined,
              ctx.action.ip,
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
