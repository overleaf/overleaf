const { expect } = require('chai')
const { ReadableString } = require('../../index')

describe('ReadableString', function () {
  it('should emit the string passed to it', function (done) {
    const stringStream = new ReadableString('hello world')
    let data = ''
    stringStream.on('data', chunk => {
      data += chunk.toString()
    })
    stringStream.on('end', () => {
      expect(data).to.equal('hello world')
      done()
    })
  })
})
