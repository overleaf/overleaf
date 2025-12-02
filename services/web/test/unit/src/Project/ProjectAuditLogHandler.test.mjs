import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs'

const { ObjectId } = mongodb

const projectId = new ObjectId()
const userId = new ObjectId()
const subscriptionId = new ObjectId()
const previousOwnerId = new ObjectId()
const newOwnerId = new ObjectId()
const subscriptionId2 = new ObjectId()

describe('ProjectAuditLogHandler', function (ctx) {
  beforeEach(async function (ctx) {
    ctx.createEntryMock = sinon.stub().resolves()
    vi.doMock('../../../../app/src/models/ProjectAuditLogEntry', () => ({
      ProjectAuditLogEntry: {
        create: ctx.createEntryMock,
      },
    }))

    ctx.getUniqueManagedSubscriptionMemberOfMock = sinon.stub().resolves()
    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator.mjs',
      () => ({
        default: {
          promises: {
            getUniqueManagedSubscriptionMemberOf:
              ctx.getUniqueManagedSubscriptionMemberOfMock,
          },
        },
      })
    )

    ctx.ProjectAuditLogHandler = (await import(modulePath)).default
  })

  describe('addEntry', function () {
    it('creates an entry in the database', async function (ctx) {
      await ctx.ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'project-op',
        userId,
        '0:0:0:0'
      )
      expect(ctx.createEntryMock).to.have.been.calledOnceWith({
        operation: 'project-op',
        projectId,
        initiatorId: userId,
        ipAddress: '0:0:0:0',
        info: {},
      })
    })

    it('does not include managedSubscriptionId when the user is not managed ', async function (ctx) {
      await ctx.ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'accept-invite', // this event logs managedSubscriptionId when available
        userId,
        '0:0:0:0'
      )
      expect(ctx.createEntryMock).not.to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId,
      })
    })

    it('includes managedSubscriptionId when the user is managed ', async function (ctx) {
      ctx.getUniqueManagedSubscriptionMemberOfMock.resolves({
        _id: subscriptionId,
      })
      await ctx.ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'accept-invite', // this event logs managedSubscriptionId when available
        userId,
        '0:0:0:0'
      )
      expect(ctx.createEntryMock).to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId.toString(),
      })
    })

    it('does not include managedSubscriptionId when the user is managed, but the event is not of managed group interest', async function (ctx) {
      ctx.getUniqueManagedSubscriptionMemberOfMock.resolves({
        _id: subscriptionId,
      })
      await ctx.ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'any-event',
        userId,
        '0:0:0:0'
      )
      expect(ctx.createEntryMock).not.to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId,
      })
    })

    it('adds multiple entries when the log involves multiple group subscriptions', async function (ctx) {
      ctx.getUniqueManagedSubscriptionMemberOfMock.onFirstCall().resolves({
        _id: subscriptionId,
      })
      ctx.getUniqueManagedSubscriptionMemberOfMock.onSecondCall().resolves({
        _id: subscriptionId2,
      })
      await ctx.ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'transfer-ownership',
        userId,
        '0:0:0:0',
        { previousOwnerId, newOwnerId }
      )
      expect(ctx.createEntryMock).to.have.been.calledTwice
      expect(ctx.createEntryMock).to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId.toString(),
      })
      expect(ctx.createEntryMock).to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId2.toString(),
      })
    })
  })

  describe('addEntryIfManaged', function () {
    describe('when the user is managed', function () {
      beforeEach(function (ctx) {
        ctx.getUniqueManagedSubscriptionMemberOfMock.resolves({
          _id: subscriptionId,
        })
      })

      it('adds an entry in the DB if the event is of interest of managed groups ', async function (ctx) {
        await ctx.ProjectAuditLogHandler.promises.addEntryIfManaged(
          projectId,
          'accept-invite', // this event logs managedSubscriptionId when available
          userId,
          '0:0:0:0'
        )
        expect(ctx.createEntryMock).to.have.been.calledOnceWith({
          operation: 'accept-invite',
          projectId,
          initiatorId: userId,
          ipAddress: '0:0:0:0',
          info: {},
          managedSubscriptionId: subscriptionId.toString(),
        })
      })

      it('does not add an entry in the DB when the event is not of interest of managed groups ', async function (ctx) {
        await ctx.ProjectAuditLogHandler.promises.addEntryIfManaged(
          projectId,
          'foo',
          userId,
          '0:0:0:0'
        )
        expect(ctx.createEntryMock).not.to.have.been.called
      })
    })

    describe('when the user is not managed', function () {
      it('does not add an entry in the DB ', async function (ctx) {
        await ctx.ProjectAuditLogHandler.promises.addEntryIfManaged(
          projectId,
          'accept-invite', // this event logs managedSubscriptionId when available
          userId,
          '0:0:0:0'
        )
        expect(ctx.createEntryMock).not.to.have.been.called
      })
    })

    it('adds multiple entries when the log involves multiple group subscriptions', async function (ctx) {
      ctx.getUniqueManagedSubscriptionMemberOfMock.onFirstCall().resolves({
        _id: subscriptionId,
      })
      ctx.getUniqueManagedSubscriptionMemberOfMock.onSecondCall().resolves({
        _id: subscriptionId2,
      })
      await ctx.ProjectAuditLogHandler.promises.addEntryIfManaged(
        projectId,
        'transfer-ownership',
        userId,
        '0:0:0:0',
        { previousOwnerId, newOwnerId }
      )
      expect(ctx.createEntryMock).to.have.been.calledTwice
      expect(ctx.createEntryMock).to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId.toString(),
      })
      expect(ctx.createEntryMock).to.have.been.calledWithMatch({
        managedSubscriptionId: subscriptionId2.toString(),
      })
    })
  })
})
