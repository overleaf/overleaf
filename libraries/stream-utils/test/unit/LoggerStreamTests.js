const { expect } = require('chai')
const { LoggerStream } = require('../../index')

describe('LoggerStream', function () {
  it('should log the size of the stream when it exceeds the limit', function (done) {
    const maxSize = 10
    const loggedSizes = []
    const loggerStream = new LoggerStream(maxSize, (size, isFlush) => {
      loggedSizes.push([size, isFlush])
      if (isFlush) {
        expect(loggedSizes).to.deep.equal([
          [11, undefined],
          [11, true],
        ])
        done()
      }
    })
    loggerStream.write(Buffer.alloc(maxSize))
    loggerStream.write(Buffer.alloc(1))
    loggerStream.end()
  })

  it('should not log the size of the stream if it does not exceed the limit', function (done) {
    const maxSize = 10
    const loggedSizes = []
    const loggerStream = new LoggerStream(maxSize, (size, isFlush) => {
      loggedSizes.push(size)
    })
    loggerStream.write(Buffer.alloc(maxSize))
    loggerStream.end()
    loggerStream.on('finish', () => {
      expect(loggedSizes).to.deep.equal([])
      done()
    })
  })
})
