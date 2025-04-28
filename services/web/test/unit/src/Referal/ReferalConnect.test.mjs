import esmock from 'esmock'
const modulePath = new URL(
  '../../../../app/src/Features/Referal/ReferalConnect.mjs',
  import.meta.url
).pathname

describe('Referal connect middle wear', function () {
  beforeEach(async function () {
    this.connect = await esmock.strict(modulePath, {})
  })

  it('should take a referal query string and put it on the session if it exists', function (done) {
    const req = {
      query: { referal: '12345' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal(req.query.referal)
      done()
    })
  })

  it('should not change the referal_id on the session if not in query', function (done) {
    const req = {
      query: {},
      session: { referal_id: 'same' },
    }
    this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal('same')
      done()
    })
  })

  it('should take a facebook referal query string and put it on the session if it exists', function (done) {
    const req = {
      query: { fb_ref: '12345' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_id.should.equal(req.query.fb_ref)
      done()
    })
  })

  it('should map the facebook medium into the session', function (done) {
    const req = {
      query: { rm: 'fb' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('facebook')
      done()
    })
  })

  it('should map the twitter medium into the session', function (done) {
    const req = {
      query: { rm: 't' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('twitter')
      done()
    })
  })

  it('should map the google plus medium into the session', function (done) {
    const req = {
      query: { rm: 'gp' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('google_plus')
      done()
    })
  })

  it('should map the email medium into the session', function (done) {
    const req = {
      query: { rm: 'e' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('email')
      done()
    })
  })

  it('should map the direct medium into the session', function (done) {
    const req = {
      query: { rm: 'd' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_medium.should.equal('direct')
      done()
    })
  })

  it('should map the bonus source into the session', function (done) {
    const req = {
      query: { rs: 'b' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('bonus')
      done()
    })
  })

  it('should map the public share source into the session', function (done) {
    const req = {
      query: { rs: 'ps' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('public_share')
      done()
    })
  })

  it('should map the collaborator invite into the session', function (done) {
    const req = {
      query: { rs: 'ci' },
      session: {},
    }
    this.connect.use(req, {}, () => {
      req.session.referal_source.should.equal('collaborator_invite')
      done()
    })
  })
})
