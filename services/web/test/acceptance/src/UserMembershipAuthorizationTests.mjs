import { expect } from 'chai'
import async from 'async'
import User from './helpers/User.mjs'
import Institution from './helpers/Institution.mjs'
import Subscription from './helpers/Subscription.mjs'
import Publisher from './helpers/Publisher.mjs'
import sinon from 'sinon'
import RecurlyClient from '../../../app/src/Features/Subscription/RecurlyClient.mjs'
import Settings from '@overleaf/settings'
import Features from '../../../app/src/infrastructure/Features.mjs'

describe('UserMembershipAuthorization', function () {
  beforeEach(function (done) {
    if (!Features.hasFeature('saas')) {
      this.skip()
    }

    this.user = new User()
    sinon.stub(RecurlyClient.promises, 'getSubscription').resolves({})

    this.adminRolesEnabledStub = sinon.stub(Settings, 'adminRolesEnabled')
    this.adminRolesEnabledStub.value(true)

    this.adminPrivilegeAvailableStub = sinon.stub(
      Settings,
      'adminPrivilegeAvailable'
    )
    this.adminPrivilegeAvailableStub.value(true)

    async.series([this.user.ensureUserExists.bind(this.user)], done)
  })

  afterEach(function () {
    if (!Features.hasFeature('saas')) {
      return
    }

    RecurlyClient.promises.getSubscription.restore()
    this.adminRolesEnabledStub.restore()
    this.adminPrivilegeAvailableStub.restore()
  })

  describe('group', function () {
    beforeEach(function (done) {
      this.subscription = new Subscription({
        groupPlan: true,
      })
      async.series(
        [
          this.subscription.ensureExists.bind(this.subscription),
          cb => this.user.login(cb),
        ],
        done
      )
    })

    describe('users management', function () {
      it('should allow managers only', function (done) {
        const url = `/manage/groups/${this.subscription._id}/members`
        async.series(
          [
            expectAccess(this.user, url, 403),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })

    describe('managers management', function () {
      it('should allow managers only', function (done) {
        const url = `/manage/groups/${this.subscription._id}/managers`
        async.series(
          [
            expectAccess(this.user, url, 403),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })
  })

  describe('institution', function () {
    beforeEach(async function () {
      this.institution = new Institution()
      await this.institution.ensureExists(this.institution)
    })

    describe('users management', function () {
      it('should allow managers only', function (done) {
        const url = `/manage/institutions/${this.institution.v1Id}/managers`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 403),
            cb => this.institution.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })

    describe('creation', function () {
      it('should allow admin only', function (done) {
        const url = `/entities/institution/create/foo`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 403),
            cb => this.user.ensureAdmin(cb),
            cb => this.user.ensureAdminRole('engineering', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })
  })

  describe('publisher', function () {
    beforeEach(function (done) {
      this.publisher = new Publisher({})
      async.series(
        [
          this.publisher.ensureExists.bind(this.publisher),
          cb => this.user.login(cb),
        ],
        done
      )
    })

    describe('managers management', function () {
      it('should allow managers only', function (done) {
        const url = `/manage/publishers/${this.publisher.slug}/managers`
        async.series(
          [
            expectAccess(this.user, url, 403),
            cb => this.publisher.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })

    describe('creation', function () {
      it('should redirect admin only', function (done) {
        const url = `/manage/publishers/foo/managers`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 404),
            cb => this.user.ensureAdmin(cb),
            cb => this.user.ensureAdminRole('engineering', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/create/),
          ],
          done
        )
      })

      it('should allow admin only', function (done) {
        const url = `/entities/publisher/create/foo`
        async.series(
          [
            expectAccess(this.user, url, 403),
            cb => this.user.ensureAdmin(cb),
            cb => this.user.ensureAdminRole('engineering', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200),
          ],
          done
        )
      })
    })
  })
})

function expectAccess(user, url, status, pattern) {
  return callback => {
    user.request.get({ url }, (error, response, body) => {
      if (error) {
        return callback(error)
      }
      expect(response.statusCode).to.equal(status)
      if (pattern) {
        expect(body).to.match(pattern)
      }
      callback()
    })
  }
}
