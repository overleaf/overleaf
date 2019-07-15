/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsBuilder.js'
)

describe('NotificationsBuilder', function() {
  const user_id = '123nd3ijdks'

  beforeEach(function() {
    this.handler = { createNotification: sinon.stub().callsArgWith(6) }

    this.settings = { apis: { v1: { url: 'v1.url', user: '', pass: '' } } }
    this.body = { id: 1, name: 'stanford', enrolment_ad_html: 'v1 ad content' }
    const response = { statusCode: 200 }
    this.request = sinon
      .stub()
      .returns(this.stubResponse)
      .callsArgWith(1, null, response, this.body)
    return (this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './NotificationsHandler': this.handler,
        'settings-sharelatex': this.settings,
        request: this.request,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    }))
  })

  it('should call v1 and create affiliation notifications', function(done) {
    const ip = '192.168.0.1'
    return this.controller
      .ipMatcherAffiliation(user_id)
      .create(ip, callback => {
        this.request.calledOnce.should.equal(true)
        const expectedOpts = {
          university_name: this.body.name,
          content: this.body.enrolment_ad_html
        }
        this.handler.createNotification
          .calledWith(
            user_id,
            `ip-matched-affiliation-${this.body.id}`,
            'notification_ip_matched_affiliation',
            expectedOpts
          )
          .should.equal(true)
        return done()
      })
  })
})
