const { expect } = require('chai')
const User = require('./helpers/User')

describe('UnsupportedBrowsers', function () {
  beforeEach(function (done) {
    this.user = new User()
    this.user.login(done)
  })

  it('allows bots', function (done) {
    this.user.request(
      {
        url: '/project',
        headers: {
          // Googlebot user agent
          'user-agent':
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      },
      (error, response) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(200)
        done()
      }
    )
  })

  it('allows supported browsers', function (done) {
    this.user.request(
      {
        url: '/project',
        headers: {
          // Chrome 90 user agent
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.72 Safari/537.36'
        }
      },
      (error, response) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(200)
        done()
      }
    )
  })

  it('redirects unsupported browsers to unsupported page', function (done) {
    this.user.request(
      {
        url: '/project',
        headers: {
          // IE11 user agent
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko'
        }
      },
      (error, response) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/unsupported-browser')
        done()
      }
    )
  })
})
