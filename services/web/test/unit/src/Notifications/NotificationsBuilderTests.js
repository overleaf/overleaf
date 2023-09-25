const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsBuilder.js'
)

describe('NotificationsBuilder', function () {
  const userId = '123nd3ijdks'

  beforeEach(function () {
    this.handler = { createNotification: sinon.stub().callsArgWith(6) }
    this.settings = { apis: { v1: { url: 'v1.url', user: '', pass: '' } } }
    this.request = sinon.stub()
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './NotificationsHandler': this.handler,
        '@overleaf/settings': this.settings,
        request: this.request,
      },
    })
  })

  describe('dropboxUnlinkedDueToLapsedReconfirmation', function (done) {
    it('should create the notification', function (done) {
      this.controller
        .dropboxUnlinkedDueToLapsedReconfirmation(userId)
        .create(error => {
          expect(error).to.not.exist
          expect(this.handler.createNotification).to.have.been.calledWith(
            userId,
            'drobox-unlinked-due-to-lapsed-reconfirmation',
            'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
            {},
            null,
            true
          )
          done()
        })
    })
    describe('NotificationsHandler error', function () {
      let anError
      beforeEach(function () {
        anError = new Error('oops')
        this.handler.createNotification.yields(anError)
      })
      it('should return errors from NotificationsHandler', function (done) {
        this.controller
          .dropboxUnlinkedDueToLapsedReconfirmation(userId)
          .create(error => {
            expect(error).to.exist
            expect(error).to.deep.equal(anError)
            done()
          })
      })
    })
  })

  describe('groupInvitation', function (done) {
    const subscriptionId = '123123bcabca'
    beforeEach(function () {
      this.invite = {
        token: '123123abcabc',
        inviterName: 'Mr Overleaf',
        managedUsersEnabled: false,
      }
    })

    it('should create the notification', function (done) {
      this.controller
        .groupInvitation(
          userId,
          subscriptionId,
          this.invite.managedUsersEnabled
        )
        .create(this.invite, error => {
          expect(error).to.not.exist
          expect(this.handler.createNotification).to.have.been.calledWith(
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
          done()
        })
    })
  })

  describe('ipMatcherAffiliation', function () {
    describe('with portal and with SSO', function () {
      beforeEach(function () {
        this.body = {
          id: 1,
          name: 'stanford',
          enrolment_ad_html: 'v1 ad content',
          is_university: true,
          portal_slug: null,
          sso_enabled: false,
        }
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should call v1 and create affiliation notifications', function (done) {
        const ip = '192.168.0.1'
        this.controller.ipMatcherAffiliation(userId).create(ip, callback => {
          this.request.calledOnce.should.equal(true)
          const expectedOpts = {
            institutionId: this.body.id,
            university_name: this.body.name,
            content: this.body.enrolment_ad_html,
            ssoEnabled: false,
            portalPath: undefined,
          }
          this.handler.createNotification
            .calledWith(
              userId,
              `ip-matched-affiliation-${this.body.id}`,
              'notification_ip_matched_affiliation',
              expectedOpts
            )
            .should.equal(true)
          done()
        })
      })
    })
    describe('without portal and without SSO', function () {
      beforeEach(function () {
        this.body = {
          id: 1,
          name: 'stanford',
          enrolment_ad_html: 'v1 ad content',
          is_university: true,
          portal_slug: 'stanford',
          sso_enabled: true,
        }
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should call v1 and create affiliation notifications', function (done) {
        const ip = '192.168.0.1'
        this.controller.ipMatcherAffiliation(userId).create(ip, callback => {
          this.request.calledOnce.should.equal(true)
          const expectedOpts = {
            institutionId: this.body.id,
            university_name: this.body.name,
            content: this.body.enrolment_ad_html,
            ssoEnabled: true,
            portalPath: '/edu/stanford',
          }
          this.handler.createNotification
            .calledWith(
              userId,
              `ip-matched-affiliation-${this.body.id}`,
              'notification_ip_matched_affiliation',
              expectedOpts
            )
            .should.equal(true)
          done()
        })
      })
    })
  })
})
