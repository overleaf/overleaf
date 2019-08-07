/* eslint-disable
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
  '../../../../app/src/Features/Referal/ReferalConnect.js'
)

describe('Referal connect middle wear', function() {
  beforeEach(function() {
    return (this.connect = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    }))
  })

  it('should take a referal query string and put it on the session if it exists', function(done) {
    const req = {
      query: { referal: '12345' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal(req.query.referal)
      return done()
    })
  })

  it('should not change the referal_id on the session if not in query', function(done) {
    const req = {
      query: {},
      session: { referal_id: 'same' }
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal('same')
      return done()
    })
  })

  it('should take a facebook referal query string and put it on the session if it exists', function(done) {
    const req = {
      query: { fb_ref: '12345' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal(req.query.fb_ref)
      return done()
    })
  })

  it('should map the facebook medium into the session', function(done) {
    const req = {
      query: { rm: 'fb' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('facebook')
      return done()
    })
  })

  it('should map the twitter medium into the session', function(done) {
    const req = {
      query: { rm: 't' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('twitter')
      return done()
    })
  })

  it('should map the google plus medium into the session', function(done) {
    const req = {
      query: { rm: 'gp' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('google_plus')
      return done()
    })
  })

  it('should map the email medium into the session', function(done) {
    const req = {
      query: { rm: 'e' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('email')
      return done()
    })
  })

  it('should map the direct medium into the session', function(done) {
    const req = {
      query: { rm: 'd' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('direct')
      return done()
    })
  })

  it('should map the bonus source into the session', function(done) {
    const req = {
      query: { rs: 'b' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('bonus')
      return done()
    })
  })

  it('should map the public share source into the session', function(done) {
    const req = {
      query: { rs: 'ps' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('public_share')
      return done()
    })
  })

  it('should map the collaborator invite into the session', function(done) {
    const req = {
      query: { rs: 'ci' },
      session: {}
    }
    return this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('collaborator_invite')
      return done()
    })
  })
})
