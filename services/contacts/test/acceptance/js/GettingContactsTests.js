import { ObjectId } from 'mongodb'
import request from 'request'
import async from 'async'
import { app } from '../../../app/js/server.js'

const HOST = 'http://127.0.0.1:3036'

describe('Getting Contacts', function () {
  before(function (done) {
    this.server = app.listen(3036, '127.0.0.1', error => {
      if (error != null) {
        throw error
      }

      done()
    })
  })

  after(function () {
    this.server.close()
  })

  describe('with no contacts', function () {
    beforeEach(function () {
      this.user_id = new ObjectId().toString()
    })

    it('should return an empty array', function (done) {
      request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts`,
          json: true,
        },
        (error, response, body) => {
          if (error) {
            return done(error)
          }
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([])
          done()
        }
      )
    })
  })

  describe('with contacts', function () {
    beforeEach(function (done) {
      this.user_id = new ObjectId().toString()
      this.contact_id_1 = new ObjectId().toString()
      this.contact_id_2 = new ObjectId().toString()
      this.contact_id_3 = new ObjectId().toString()

      const touchContact = (userId, contactId, cb) =>
        request(
          {
            method: 'POST',
            url: `${HOST}/user/${userId}/contacts`,
            json: {
              contact_id: contactId,
            },
          },
          cb
        )

      async.series(
        [
          // 2 is preferred since touched twice, then 3 since most recent, then 1
          cb => touchContact(this.user_id, this.contact_id_1, cb),
          cb => touchContact(this.user_id, this.contact_id_2, cb),
          cb => touchContact(this.user_id, this.contact_id_2, cb),
          cb => touchContact(this.user_id, this.contact_id_3, cb),
        ],
        done
      )
    })

    it('should return a sorted list of contacts', function (done) {
      request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts`,
          json: true,
        },
        (error, response, body) => {
          if (error) {
            return done(error)
          }
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([
            this.contact_id_2,
            this.contact_id_3,
            this.contact_id_1,
          ])
          done()
        }
      )
    })

    it('should respect a limit and only return top X contacts', function (done) {
      request(
        {
          method: 'GET',
          url: `${HOST}/user/${this.user_id}/contacts?limit=2`,
          json: true,
        },
        (error, response, body) => {
          if (error) {
            return done(error)
          }
          response.statusCode.should.equal(200)
          body.contact_ids.should.deep.equal([
            this.contact_id_2,
            this.contact_id_3,
          ])
          done()
        }
      )
    })
  })
})
