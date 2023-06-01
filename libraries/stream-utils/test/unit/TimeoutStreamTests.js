const { expect } = require('chai')
const { TimeoutStream, AbortError } = require('../../index')

describe('TimeoutStream', function () {
  it('should emit an error if the stream times out', function (done) {
    const timeout = 10
    const timeoutStream = new TimeoutStream(timeout)
    timeoutStream.on('error', err => {
      expect(err).to.be.an.instanceOf(AbortError)
      done()
    })
  })

  it('should not emit an error if the stream does not time out', function (done) {
    const timeout = 100
    const timeoutStream = new TimeoutStream(timeout)
    setTimeout(() => {
      timeoutStream.end()
      done()
    }, 1)
  })
})
