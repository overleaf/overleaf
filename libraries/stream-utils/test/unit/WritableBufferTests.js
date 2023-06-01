const { expect } = require('chai')
const { WritableBuffer } = require('../../index')

describe('WritableBuffer', function () {
  it('should store all data written to it in a node Buffer', function () {
    const bufferStream = new WritableBuffer()
    bufferStream.write('hello')
    bufferStream.write('world')
    bufferStream.end()
    expect(bufferStream.contents().toString()).to.equal('helloworld')
  })

  it('should return the size of the data written to it', function () {
    const bufferStream = new WritableBuffer()
    bufferStream.write('hello')
    bufferStream.write('world')
    bufferStream.end()
    expect(bufferStream.size()).to.equal(10)
  })
})
