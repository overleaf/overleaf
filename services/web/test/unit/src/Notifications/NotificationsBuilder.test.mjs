import { vi, expect } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Notifications/NotificationsBuilder.mjs'
)

describe('NotificationsBuilder', function () {
  const userId = '507f1f77bcf86cd799439011'

  beforeEach(async function (ctx) {
    ctx.handler = { promises: { createNotification: sinon.stub().resolves() } }
    ctx.settings = {
      apis: { v1: { url: 'http://v1.url', user: '', pass: '' } },
    }
    ctx.FetchUtils = {
      fetchJson: sinon.stub(),
    }

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsHandler',
      () => ({
        default: ctx.handler,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    ctx.controller = (await import(modulePath)).default
  })

  describe('dropboxUnlinkedDueToLapsedReconfirmation', function () {
    it('should create the notification', async function (ctx) {
      await ctx.controller.promises
        .dropboxUnlinkedDueToLapsedReconfirmation(userId)
        .create()
      expect(ctx.handler.promises.createNotification).to.have.been.calledWith(
        userId,
        'drobox-unlinked-due-to-lapsed-reconfirmation',
        'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
        {},
        null,
        true
      )
    })
    describe('NotificationsHandler error', function () {
      let anError
      beforeEach(function (ctx) {
        anError = new Error('oops')
        ctx.handler.promises.createNotification.rejects(anError)
      })
      it('should return errors from NotificationsHandler', async function (ctx) {
        let error

        try {
          await ctx.controller.promises
            .dropboxUnlinkedDueToLapsedReconfirmation(userId)
            .create()
        } catch (err) {
          error = err
        }

        expect(error).to.equal(anError)
      })
    })
  })

  describe('groupInvitation', function () {
    const subscriptionId = '123123bcabca'
    beforeEach(function (ctx) {
      ctx.invite = {
        token: '123123abcabc',
        inviterName: 'Mr Overleaf',
        managedUsersEnabled: false,
      }
    })

    it('should create the notification', async function (ctx) {
      await ctx.controller.promises
        .groupInvitation(userId, subscriptionId, ctx.invite.managedUsersEnabled)
        .create(ctx.invite)
      expect(ctx.handler.promises.createNotification).to.have.been.calledWith(
        userId,
        `groupInvitation-${subscriptionId}-${userId}`,
        'notification_group_invitation',
        {
          token: ctx.invite.token,
          inviterName: ctx.invite.inviterName,
          managedUsersEnabled: ctx.invite.managedUsersEnabled,
        },
        null,
        true
      )
    })
  })

  describe('ipMatcherAffiliation', function () {
    describe('with portal and with SSO', function () {
      beforeEach(function (ctx) {
        ctx.body = {
          id: 1,
          name: 'stanford',
          is_university: true,
          portal_slug: null,
          sso_enabled: false,
        }
        ctx.FetchUtils.fetchJson.resolves(ctx.body)
      })

      it('should call v1 and create affiliation notifications', async function (ctx) {
        const ip = '192.168.0.1'
        await ctx.controller.promises.ipMatcherAffiliation(userId).create(ip)
        ctx.FetchUtils.fetchJson.calledOnce.should.equal(true)
        const expectedOpts = {
          institutionId: ctx.body.id,
          university_name: ctx.body.name,
          ssoEnabled: false,
          portalPath: undefined,
        }
        ctx.handler.promises.createNotification
          .calledWith(
            userId,
            `ip-matched-affiliation-${ctx.body.id}`,
            'notification_ip_matched_affiliation',
            expectedOpts
          )
          .should.equal(true)
      })
    })
    describe('without portal and without SSO', function () {
      beforeEach(function (ctx) {
        ctx.body = {
          id: 1,
          name: 'stanford',
          is_university: true,
          portal_slug: 'stanford',
          sso_enabled: true,
        }
        ctx.FetchUtils.fetchJson.resolves(ctx.body)
      })

      it('should call v1 and create affiliation notifications', async function (ctx) {
        const ip = '192.168.0.1'
        await ctx.controller.promises.ipMatcherAffiliation(userId).create(ip)
        ctx.FetchUtils.fetchJson.calledOnce.should.equal(true)
        const expectedOpts = {
          institutionId: ctx.body.id,
          university_name: ctx.body.name,
          ssoEnabled: true,
          portalPath: '/edu/stanford',
        }
        ctx.handler.promises.createNotification
          .calledWith(
            userId,
            `ip-matched-affiliation-${ctx.body.id}`,
            'notification_ip_matched_affiliation',
            expectedOpts
          )
          .should.equal(true)
      })
    })
  })
})
