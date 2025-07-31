const modulePath = new URL(
  '../../../../app/src/Features/Referal/ReferalConnect.mjs',
  import.meta.url
).pathname

describe('Referal connect middle wear', function () {
  beforeEach(async function (ctx) {
    ctx.connect = (await import(modulePath)).default
  })

  it('should take a referal query string and put it on the session if it exists', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { referal: '12345' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_id.should.equal(req.query.referal)
        resolve()
      })
    })
  })

  it('should not change the referal_id on the session if not in query', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: {},
        session: { referal_id: 'same' },
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_id.should.equal('same')
        resolve()
      })
    })
  })

  it('should take a facebook referal query string and put it on the session if it exists', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { fb_ref: '12345' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_id.should.equal(req.query.fb_ref)
        resolve()
      })
    })
  })

  it('should map the facebook medium into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rm: 'fb' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_medium.should.equal('facebook')
        resolve()
      })
    })
  })

  it('should map the twitter medium into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rm: 't' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_medium.should.equal('twitter')
        resolve()
      })
    })
  })

  it('should map the google plus medium into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rm: 'gp' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_medium.should.equal('google_plus')
        resolve()
      })
    })
  })

  it('should map the email medium into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rm: 'e' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_medium.should.equal('email')
        resolve()
      })
    })
  })

  it('should map the direct medium into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rm: 'd' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_medium.should.equal('direct')
        resolve()
      })
    })
  })

  it('should map the bonus source into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rs: 'b' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_source.should.equal('bonus')
        resolve()
      })
    })
  })

  it('should map the public share source into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rs: 'ps' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_source.should.equal('public_share')
        resolve()
      })
    })
  })

  it('should map the collaborator invite into the session', async function (ctx) {
    await new Promise(resolve => {
      const req = {
        query: { rs: 'ci' },
        session: {},
      }
      ctx.connect.use(req, {}, () => {
        req.session.referal_source.should.equal('collaborator_invite')
        resolve()
      })
    })
  })
})
