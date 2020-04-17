const { getFullInfo, getFullStack, hasCauseInstanceOf } = require('..')

describe('OError.getFullInfo', function () {
  it('works on a normal error', function () {
    const err = new Error('foo')
    expect(getFullInfo(err)).to.deep.equal({})
  })

  it('works on an error with .info', function () {
    const err = new Error('foo')
    err.info = { userId: 123 }
    expect(getFullInfo(err)).to.deep.equal({ userId: 123 })
  })

  it('merges info from a cause chain', function () {
    const err1 = new Error('foo')
    const err2 = new Error('bar')
    err1.cause = err2
    err2.info = { userId: 123 }
    expect(getFullInfo(err1)).to.deep.equal({ userId: 123 })
  })

  it('merges info from a cause chain with no info', function () {
    const err1 = new Error('foo')
    const err2 = new Error('bar')
    err1.cause = err2
    expect(getFullInfo(err1)).to.deep.equal({})
  })

  it('merges info from a cause chain with duplicate keys', function () {
    const err1 = new Error('foo')
    const err2 = new Error('bar')
    err1.cause = err2
    err1.info = { userId: 123 }
    err2.info = { userId: 456 }
    expect(getFullInfo(err1)).to.deep.equal({ userId: 123 })
  })

  it('works on an error with .info set to a string', function () {
    const err = new Error('foo')
    err.info = 'test'
    expect(getFullInfo(err)).to.deep.equal({})
  })
})

describe('OError.getFullStack', function () {
  it('works on a normal error', function () {
    const err = new Error('foo')
    const fullStack = getFullStack(err)
    expect(fullStack).to.match(/^Error: foo$/m)
    expect(fullStack).to.match(/^\s+at /m)
  })

  it('works on an error with a cause', function () {
    const err1 = new Error('foo')
    const err2 = new Error('bar')
    err1.cause = err2

    const fullStack = getFullStack(err1)
    expect(fullStack).to.match(/^Error: foo$/m)
    expect(fullStack).to.match(/^\s+at /m)
    expect(fullStack).to.match(/^caused by: Error: bar$/m)
  })
})

describe('OError.hasCauseInstanceOf', function () {
  it('works on a normal error', function () {
    const err = new Error('foo')
    expect(hasCauseInstanceOf(null, Error)).to.be.false
    expect(hasCauseInstanceOf(err, Error)).to.be.true
    expect(hasCauseInstanceOf(err, RangeError)).to.be.false
  })

  it('works on an error with a cause', function () {
    const err1 = new Error('foo')
    const err2 = new RangeError('bar')
    err1.cause = err2

    expect(hasCauseInstanceOf(err1, Error)).to.be.true
    expect(hasCauseInstanceOf(err1, RangeError)).to.be.true
    expect(hasCauseInstanceOf(err1, TypeError)).to.be.false
  })
})
