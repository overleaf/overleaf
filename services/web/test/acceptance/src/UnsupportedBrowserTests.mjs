import { expect } from 'chai'
import User from './helpers/User.mjs'

const botUserAgents = new Map([
  [
    'Googlebot',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ],
])

const unsupportedUserAgents = new Map([
  ['IE 11', 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko'],
  [
    'Safari 13',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_12_2) AppleWebKit/629.24.7 (KHTML, like Gecko) Version/13.0.26 Safari/629.24.7',
  ],
])

const supportedUserAgents = new Map([
  [
    'Chrome 90',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.72 Safari/537.36',
  ],
  [
    'Chrome 121',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  ],
  [
    'Firefox 122',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
  ],
  [
    'Safari 14',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
  ],
  [
    'Safari 17',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  ],
])

describe('UnsupportedBrowsers', function () {
  beforeEach(function () {
    this.user = new User()
  })

  describe('allows bots', function () {
    const url = '/login'
    for (const [name, userAgent] of botUserAgents) {
      it(name, function (done) {
        this.user.request(
          {
            url,
            headers: {
              'user-agent': userAgent,
            },
          },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })
    }
  })

  describe('allows supported browsers', function () {
    const url = '/login'
    for (const [name, userAgent] of supportedUserAgents) {
      it(name, function (done) {
        this.user.request(
          {
            url,
            headers: {
              'user-agent': userAgent,
            },
          },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })
    }
  })

  describe('redirects unsupported browsers to unsupported page', function () {
    const url = '/login'
    for (const [name, userAgent] of unsupportedUserAgents) {
      it(name, function (done) {
        this.user.request(
          {
            url,
            headers: {
              'user-agent': userAgent,
            },
          },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(302)
            expect(response.headers.location).to.equal(
              '/unsupported-browser?fromURL=' + encodeURIComponent(url)
            )
            done()
          }
        )
      })
    }
  })

  it('redirects unsupported browsers from any page', function (done) {
    const url = '/foo/bar/baz'
    this.user.request(
      {
        url,
        headers: {
          'user-agent': unsupportedUserAgents.get('IE 11'),
        },
      },
      (error, response) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal(
          '/unsupported-browser?fromURL=' + encodeURIComponent(url)
        )
        done()
      }
    )
  })

  it('should render the unsupported browser page for unsupported browser', function (done) {
    const url =
      '/unsupported-browser?fromURL=' + encodeURIComponent('/foo/bar/baz')
    this.user.request(
      {
        url,
        headers: {
          'user-agent': unsupportedUserAgents.get('IE 11'),
        },
      },
      (error, response) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(200)
        done()
      }
    )
  })

  it('shows the previous URL', function (done) {
    const url = '/project/60867f47174dfd13f1e00000'
    this.user.request(
      {
        url: '/unsupported-browser?fromURL=' + encodeURIComponent(url),
        headers: {
          'user-agent': unsupportedUserAgents.get('IE 11'),
        },
      },
      (error, response, body) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(200)
        expect(body).to.include('URL:')
        expect(body).to.include(url)
        done()
      }
    )
  })

  it('shows a sanitized URL', function (done) {
    const url = 'https://evil.com/the/pathname'
    this.user.request(
      {
        url: '/unsupported-browser?fromURL=' + encodeURIComponent(url),
        headers: {
          'user-agent': unsupportedUserAgents.get('IE 11'),
        },
      },
      (error, response, body) => {
        expect(error).to.not.exist
        expect(response.statusCode).to.equal(200)
        expect(body).to.include('URL:')
        expect(body).to.not.include('evil.com')
        expect(body).to.include('/the/pathname')
        done()
      }
    )
  })
})
