const { expect } = require('chai')

const { format, pad } = require('../../src/ProjectKey.js')

describe('projectKey', function () {
  it('reverses padded keys', function () {
    expect(format(1)).to.equal('100/000/000')
    expect(format(12)).to.equal('210/000/000')
    expect(format(123456789)).to.equal('987/654/321')
    expect(format(9123456789)).to.equal('987/654/3219')
  })

  it('pads numbers with zeros to length 9', function () {
    expect(pad(undefined)).to.equal('000000000')
    expect(pad(null)).to.equal('000000000')
    expect(pad(1)).to.equal('000000001')
    expect(pad(10)).to.equal('000000010')
    expect(pad(100000000)).to.equal('100000000')
    expect(pad(1000000000)).to.equal('1000000000')
  })
})
