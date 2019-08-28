const { expect } = require('chai')
const async = require('async')
const { ObjectId } = require('../../../app/src/infrastructure/mongojs')
const User = require('./helpers/User')
const Institution = require('./helpers/Institution')
const Subscription = require('./helpers/Subscription')
const Publisher = require('./helpers/Publisher')
const MockV1Api = require('./helpers/MockV1Api')

describe('UserMembershipAuthorization', function() {
  beforeEach(function(done) {
    this.user = new User()
    async.series([this.user.ensureUserExists.bind(this.user)], done)
  })

  describe('team', function() {
    beforeEach(function(done) {
      this.subscription = new Subscription({
        groupPlan: true,
        overleaf: { id: 123 }
      })
      async.series(
        [
          this.subscription.ensureExists.bind(this.subscription),
          cb => this.user.login(cb)
        ],
        done
      )
    })

    describe('metrics', function() {
      it('should allow managers only', function(done) {
        const url = `/metrics/teams/123`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })
  })

  describe('group', function() {
    beforeEach(function(done) {
      this.subscription = new Subscription({
        groupPlan: true
      })
      async.series(
        [
          this.subscription.ensureExists.bind(this.subscription),
          cb => this.user.login(cb)
        ],
        done
      )
    })

    describe('users management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/groups/${this.subscription._id}/members`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('metrics', function() {
      it('should allow managers only', function(done) {
        const url = `/metrics/groups/${this.subscription._id}`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })

      it('should handle groups not found', function(done) {
        const url = `/metrics/groups/${ObjectId()}`
        async.series([expectAccess(this.user, url, 404)], done)
      })
    })

    describe('managers management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/groups/${this.subscription._id}/managers`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })
  })

  describe('institution', function() {
    beforeEach(function(done) {
      this.institution = new Institution()
      async.series([this.institution.ensureExists.bind(this.institution)], done)
    })

    describe('metrics', function() {
      it('should allow users with staff access', function(done) {
        const url = `/metrics/institutions/${this.institution.v1Id}`
        async.series(
          [
            cb => this.user.ensureStaffAccess('institutionMetrics', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })

      it('should allow admins', function(done) {
        const url = `/metrics/institutions/${this.institution.v1Id}`
        async.series(
          [
            this.user.ensure_admin.bind(this.user),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })

      it('should allow managers', function(done) {
        const url = `/metrics/institutions/${this.institution.v1Id}`
        async.series(
          [
            this.user.login.bind(this.user),
            cb => this.institution.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })

      it('should not allow users without access', function(done) {
        const url = `/metrics/institutions/${this.institution.v1Id}`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/restricted/)
          ],
          done
        )
      })
    })

    describe('users management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/institutions/${this.institution.v1Id}/managers`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.institution.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('hub', function() {
      it('should allow managers only', function(done) {
        const url = `/institutions/${this.institution.v1Id}/hub`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.institution.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('creation', function() {
      it('should allow staff only', function(done) {
        const url = `/entities/institution/create/foo`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.user.ensureStaffAccess('institutionManagement', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })
  })

  describe('publisher', function() {
    beforeEach(function(done) {
      this.publisher = new Publisher({})
      async.series(
        [
          this.publisher.ensureExists.bind(this.publisher),
          cb => this.user.login(cb)
        ],
        done
      )
    })

    describe('conversion metrics', function() {
      it('should allow managers only', function(done) {
        const url = `/metrics/conversions/${this.publisher.slug}`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.publisher.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('managers management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/publishers/${this.publisher.slug}/managers`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.publisher.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('creation', function() {
      it('should redirect staff only', function(done) {
        const url = `/publishers/foo/hub`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 404),
            cb => this.user.ensureStaffAccess('publisherManagement', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 302, /\/create/)
          ],
          done
        )
      })

      it('should allow staff only', function(done) {
        const url = `/entities/publisher/create/foo`
        async.series(
          [
            expectAccess(this.user, url, 302, /\/restricted/),
            cb => this.user.ensureStaffAccess('publisherManagement', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })
  })

  describe('template', function() {
    beforeEach(function(done) {
      this.publisher = new Publisher({})
      async.series(
        [
          this.publisher.ensureExists.bind(this.publisher),
          cb => this.user.login(cb)
        ],
        done
      )
    })

    it('allow publisher managers only', function(done) {
      MockV1Api.setTemplates({
        123: {
          id: 123,
          title: '123 title',
          brand: { slug: this.publisher.slug }
        }
      })
      const url = '/metrics/templates/123'
      async.series(
        [
          expectAccess(this.user, url, 302, /\/restricted/),
          cb => this.publisher.setManagerIds([this.user._id], cb),
          expectAccess(this.user, url, 200)
        ],
        done
      )
    })

    it('handle templates without publisher', function(done) {
      MockV1Api.setTemplates({
        456: {
          id: 456,
          title: '456 title',
          brand: { slug: null }
        }
      })
      const url = '/metrics/templates/456'
      async.series(
        [
          expectAccess(this.user, url, 302, /\/restricted/),
          this.user.ensure_admin.bind(this.user),
          this.user.login.bind(this.user),
          expectAccess(this.user, url, 200)
        ],
        done
      )
    })

    it('handle templates not found', function(done) {
      const url = '/metrics/templates/789'
      async.series(
        [
          this.user.ensure_admin.bind(this.user),
          this.user.login.bind(this.user),
          expectAccess(this.user, url, 404)
        ],
        done
      )
    })
  })

  describe('graph', function() {
    it('allow admins only', function(done) {
      const url = '/graphs/foo?resource_type=admin'
      async.series(
        [
          this.user.login.bind(this.user),
          expectAccess(this.user, url, 302, /\/restricted/),
          this.user.ensure_admin.bind(this.user),
          this.user.login.bind(this.user),
          expectAccess(this.user, url, 200)
        ],
        done
      )
    })
  })

  describe('admin metrics', function() {
    it('should not allow anonymous users', function(done) {
      expectAccess(this.user, '/metrics/admin', 302, /\/restricted/)(done)
    })

    it('should not allow all users', function(done) {
      async.series(
        [
          this.user.login.bind(this.user),
          expectAccess(this.user, '/metrics/admin', 302, /\/restricted/)
        ],
        done
      )
    })

    it('should allow admin users', function(done) {
      async.series(
        [
          this.user.ensure_admin.bind(this.user),
          this.user.login.bind(this.user),
          expectAccess(this.user, '/metrics/admin', 200)
        ],
        done
      )
    })

    it('should allow users with staff access', function(done) {
      async.series(
        [
          cb => this.user.ensureStaffAccess('adminMetrics', cb),
          this.user.login.bind(this.user),
          expectAccess(this.user, '/metrics/admin', 200)
        ],
        done
      )
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
