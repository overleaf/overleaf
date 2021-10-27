/* eslint-disable
    camelcase,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
chai.should()
const { expect } = chai
const { ObjectId } = require('mongodb')
const request = require('request')
const async = require('async')
const ContactsApp = require('./ContactsApp')
const HOST = 'http://localhost:3036'

describe('Getting Contacts', function () {
  describe('with no contacts', function () {
    beforeEach(function (done) {
      this.user_id = ObjectId().toString()
      return ContactsApp.ensureRunning(done)
    })

    return it('should return an empty array', function (done) {
      return request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts`,
          json: true,
        },
        (error, response, body) => {
          if (error) return done(error)
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([])
          return done()
        }
      )
    })
  })

  return describe('with contacts', function () {
    beforeEach(function (done) {
      this.user_id = ObjectId().toString()
      this.contact_id_1 = ObjectId().toString()
      this.contact_id_2 = ObjectId().toString()
      this.contact_id_3 = ObjectId().toString()

      const touchContact = (user_id, contact_id, cb) =>
        request(
          {
            method: 'POST',
            url: `${HOST}/user/${user_id}/contacts`,
            json: {
              contact_id,
            },
          },
          cb
        )

      return async.series(
        [
          // 2 is preferred since touched twice, then 3 since most recent, then 1
          cb => ContactsApp.ensureRunning(cb),
          cb => touchContact(this.user_id, this.contact_id_1, cb),
          cb => touchContact(this.user_id, this.contact_id_2, cb),
          cb => touchContact(this.user_id, this.contact_id_2, cb),
          cb => touchContact(this.user_id, this.contact_id_3, cb),
        ],
        done
      )
    })

    it('should return a sorted list of contacts', function (done) {
      return request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts`,
          json: true,
        },
        (error, response, body) => {
          if (error) return done(error)
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([
            this.contact_id_2,
            this.contact_id_3,
            this.contact_id_1,
          ])
          return done()
        }
      )
    })

    return it('should respect a limit and only return top X contacts', function (done) {
      return request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts?limit=2`,
          json: true,
        },
        (error, response, body) => {
          if (error) return done(error)
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([
            this.contact_id_2,
            this.contact_id_3,
          ])
          return done()
        }
      )
    })
  })
})
