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
const assert = require('assert')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsController.js'
)

describe('NotificationsController', function() {
  const user_id = '123nd3ijdks'
  const notification_id = '123njdskj9jlk'

  beforeEach(function() {
    this.handler = {
      getUserNotifications: sinon.stub().callsArgWith(1),
      markAsRead: sinon.stub().callsArgWith(2)
    }
    this.req = {
      params: {
        notification_id
      },
      session: {
        user: {
          _id: user_id
        }
      },
      i18n: {
        translate() {}
      }
    }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.req.session.user._id)
    }
    return (this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './NotificationsHandler': this.handler,
        underscore: (this.underscore = {
          map(arr) {
            return arr
          }
        }),
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        '../Authentication/AuthenticationController': this
          .AuthenticationController
      }
    }))
  })

  it('should ask the handler for all unread notifications', function(done) {
    const allNotifications = [{ _id: notification_id, user_id }]
    this.handler.getUserNotifications = sinon
      .stub()
      .callsArgWith(1, null, allNotifications)
    return this.controller.getAllUnreadNotifications(this.req, {
      send: body => {
        body.should.equal(allNotifications)
        this.handler.getUserNotifications.calledWith(user_id).should.equal(true)
        return done()
      }
    })
  })

  it('should send a delete request when a delete has been received to mark a notification', function(done) {
    return this.controller.markNotificationAsRead(this.req, {
      send: () => {
        this.handler.markAsRead
          .calledWith(user_id, notification_id)
          .should.equal(true)
        return done()
      }
    })
  })
})
