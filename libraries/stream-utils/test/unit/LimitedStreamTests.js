const { expect } = require('chai')
const { LimitedStream, SizeExceededError } = require('../../index')

describe('LimitedStream', function () {
  it('should emit an error if the stream size exceeds the limit', function (done) {
    const maxSize = 10
    const limitedStream = new LimitedStream(maxSize)
    limitedStream.on('error', err => {
      expect(err).to.be.an.instanceOf(SizeExceededError)
      done()
    })
    limitedStream.write(Buffer.alloc(maxSize + 1))
  })

  it('should pass through data if the stream size does not exceed the limit', function (done) {
    const maxSize = 15
    const limitedStream = new LimitedStream(maxSize)
    let data = ''
    limitedStream.on('data', chunk => {
      data += chunk.toString()
    })
    limitedStream.on('end', () => {
      expect(data).to.equal('hello world')
      done()
    })
    limitedStream.write('hello')
    limitedStream.write(' world')
    limitedStream.end()
  })
})
