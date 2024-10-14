import Settings from '@overleaf/settings'
import request from './helpers/request.js'

// create a string that is longer than the max allowed (as defined in Server.js)
const wayTooLongString = 'a'.repeat(Settings.max_json_request_size + 1)

describe('BodyParserErrors', function () {
  describe('when request is too large', function () {
    describe('json', function () {
      it('return 413', function (done) {
        request.post(
          {
            url: '/login',
            body: { password: wayTooLongString },
            json: true,
          },
          (error, response, body) => {
            if (error) {
              return done(error)
            }
            response.statusCode.should.equal(413)
            body.should.deep.equal({})
            done()
          }
        )
      })
    })

    describe('urlencoded', function () {
      it('return 413', function (done) {
        request.post(
          {
            url: '/login',
            form: { password: wayTooLongString },
          },
          (error, response, body) => {
            if (error) {
              return done(error)
            }
            response.statusCode.should.equal(413)
            body.should.match(/There was a problem with your request/)
            done()
          }
        )
      })
    })
  })

  describe('when request is not too large', function () {
    describe('json', function () {
      it('return normal status code', function (done) {
        request.post(
          {
            url: '/login',
            body: { password: 'foo' },
            json: true,
          },
          (error, response, body) => {
            if (error) {
              return done(error)
            }
            response.statusCode.should.equal(403)
            done()
          }
        )
      })
    })

    describe('urlencoded', function () {
      it('return normal status code', function (done) {
        request.post(
          {
            url: '/login',
            form: { password: 'foo' },
          },
          (error, response, body) => {
            if (error) {
              return done(error)
            }
            response.statusCode.should.equal(403)
            done()
          }
        )
      })
    })
  })
})
