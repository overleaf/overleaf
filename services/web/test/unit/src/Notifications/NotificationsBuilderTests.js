const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsBuilder.js'
)

describe('NotificationsBuilder', function () {
  const userId = '507f1f77bcf86cd799439011'

  beforeEach(function () {
    this.handler = { promises: { createNotification: sinon.stub().resolves() } }
    this.settings = {
      apis: { v1: { url: 'http://v1.url', user: '', pass: '' } },
    }
    this.FetchUtils = {
      fetchJson: sinon.stub(),
    }
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './NotificationsHandler': this.handler,
        '@overleaf/settings': this.settings,
        '@overleaf/fetch-utils': this.FetchUtils,
      },
    })
  })

  describe('dropboxUnlinkedDueToLapsedReconfirmation', function () {
    it('should create the notification', async function () {
      await this.controller.promises
        .dropboxUnlinkedDueToLapsedReconfirmation(userId)
        .create()
      expect(this.handler.promises.createNotification).to.have.been.calledWith(
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
      beforeEach(function () {
        anError = new Error('oops')
        this.handler.promises.createNotification.rejects(anError)
      })
      it('should return errors from NotificationsHandler', async function () {
        let error

        try {
          await this.controller.promises
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
    beforeEach(function () {
      this.invite = {
        token: '123123abcabc',
        inviterName: 'Mr Overleaf',
        managedUsersEnabled: false,
      }
    })

    it('should create the notification', async function () {
      await this.controller.promises
        .groupInvitation(
          userId,
          subscriptionId,
          this.invite.managedUsersEnabled
        )
        .create(this.invite)
      expect(this.handler.promises.createNotification).to.have.been.calledWith(
        userId,
        `groupInvitation-${subscriptionId}-${userId}`,
        'notification_group_invitation',
        {
          token: this.invite.token,
          inviterName: this.invite.inviterName,
          managedUsersEnabled: this.invite.managedUsersEnabled,
        },
        null,
        true
      )
    })
  })

  describe('ipMatcherAffiliation', function () {
    describe('with portal and with SSO', function () {
      beforeEach(function () {
        this.body = {
          id: 1,
          name: 'stanford',
          is_university: true,
          portal_slug: null,
          sso_enabled: false,
        }
        this.FetchUtils.fetchJson.resolves(this.body)
      })

      it('should call v1 and create affiliation notifications', async function () {
        const ip = '192.168.0.1'
        await this.controller.promises.ipMatcherAffiliation(userId).create(ip)
        this.FetchUtils.fetchJson.calledOnce.should.equal(true)
        const expectedOpts = {
          institutionId: this.body.id,
          university_name: this.body.name,
          ssoEnabled: false,
          portalPath: undefined,
        }
        this.handler.promises.createNotification
          .calledWith(
            userId,
            `ip-matched-affiliation-${this.body.id}`,
            'notification_ip_matched_affiliation',
            expectedOpts
          )
          .should.equal(true)
      })
    })
    describe('without portal and without SSO', function () {
      beforeEach(function () {
        this.body = {
          id: 1,
          name: 'stanford',
          is_university: true,
          portal_slug: 'stanford',
          sso_enabled: true,
        }
        this.FetchUtils.fetchJson.resolves(this.body)
      })

      it('should call v1 and create affiliation notifications', async function () {
        const ip = '192.168.0.1'
        await this.controller.promises.ipMatcherAffiliation(userId).create(ip)
        this.FetchUtils.fetchJson.calledOnce.should.equal(true)
        const expectedOpts = {
          institutionId: this.body.id,
          university_name: this.body.name,
          ssoEnabled: true,
          portalPath: '/edu/stanford',
        }
        this.handler.promises.createNotification
          .calledWith(
            userId,
            `ip-matched-affiliation-${this.body.id}`,
            'notification_ip_matched_affiliation',
            expectedOpts
          )
          .should.equal(true)
      })
    })
  })
})
