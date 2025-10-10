'use strict'

const { expect } = require('chai')
const ot = require('../..')
const HollowStringFileData = require('../../lib/file_data/hollow_string_file_data')
const TextOperation = ot.TextOperation

describe('HollowStringFileData', function () {
  it('validates string length when edited', function () {
    const maxLength = TextOperation.MAX_STRING_LENGTH
    const fileData = new HollowStringFileData(maxLength)
    expect(fileData.getStringLength()).to.equal(maxLength)

    expect(() => {
      fileData.edit(new TextOperation().retain(maxLength).insert('x'))
    }).to.throw(TextOperation.TooLongError)
    expect(fileData.getStringLength()).to.equal(maxLength)

    fileData.edit(new TextOperation().retain(maxLength - 1).remove(1))
    expect(fileData.getStringLength()).to.equal(maxLength - 1)
  })
})
