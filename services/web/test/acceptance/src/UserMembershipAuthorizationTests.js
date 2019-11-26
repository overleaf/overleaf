const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const Institution = require('./helpers/Institution')
const Subscription = require('./helpers/Subscription')
const Publisher = require('./helpers/Publisher')

describe('UserMembershipAuthorization', function() {
  beforeEach(function(done) {
    this.user = new User()
    async.series([this.user.ensureUserExists.bind(this.user)], done)
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
            expectAccess(this.user, url, 403),
            cb => this.subscription.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('managers management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/groups/${this.subscription._id}/managers`
        async.series(
          [
            expectAccess(this.user, url, 403),
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

    describe('users management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/institutions/${this.institution.v1Id}/managers`
        async.series(
          [
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 403),
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
            expectAccess(this.user, url, 403),
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

    describe('managers management', function() {
      it('should allow managers only', function(done) {
        const url = `/manage/publishers/${this.publisher.slug}/managers`
        async.series(
          [
            expectAccess(this.user, url, 403),
            cb => this.publisher.setManagerIds([this.user._id], cb),
            expectAccess(this.user, url, 200)
          ],
          done
        )
      })
    })

    describe('creation', function() {
      it('should redirect staff only', function(done) {
        const url = `/manage/publishers/foo/managers`
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
            expectAccess(this.user, url, 403),
            cb => this.user.ensureStaffAccess('publisherManagement', cb),
            this.user.login.bind(this.user),
            expectAccess(this.user, url, 200)
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
