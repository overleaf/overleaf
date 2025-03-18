const { expect } = require('chai')
const {
  parseEmail,
} = require('../../../../app/src/Features/Helpers/EmailHelper')

describe('EmailHelper', function () {
  it('should parse a single email', function () {
    const address = 'test@example.com'
    const expected = 'test@example.com'
    expect(parseEmail(address)).to.equal(expected)
    expect(parseEmail(address, true)).to.equal(expected)
  })

  it('should parse a valid email address', function () {
    const address = '"Test Person" <test@example.com>'
    const expected = 'test@example.com'
    expect(parseEmail(address)).to.equal(null)
    expect(parseEmail(address, true)).to.equal(expected)
  })

  it('should return null for garbage input', function () {
    const cases = [
      undefined,
      null,
      '',
      42,
      ['test@example.com'],
      {},
      { length: 42 },
      { trim: true, match: true },
      { toString: true },
    ]
    for (const input of cases) {
      expect(parseEmail(input)).to.equal(null, input)
      expect(parseEmail(input, true)).to.equal(null, input)
    }
  })

  it('should return null for an invalid single email', function () {
    const address = 'testexample.com'
    expect(parseEmail(address)).to.equal(null)
    expect(parseEmail(address, true)).to.equal(null)
  })

  it('should return null for an invalid email address', function () {
    const address = '"Test Person" test@example.com>'
    expect(parseEmail(address)).to.equal(null)
    expect(parseEmail(address, true)).to.equal(null)
  })

  it('should return null for a group of addresses', function () {
    const address = 'Group name:test1@example.com,test2@example.com;'
    expect(parseEmail(address)).to.equal(null)
    expect(parseEmail(address, true)).to.equal(null)
  })
})
