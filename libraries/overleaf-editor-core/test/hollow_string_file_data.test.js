'use strict'

const { expect } = require('chai')
const ot = require('..')
const HollowStringFileData = require('../lib/file_data/hollow_string_file_data')
const TextOperation = ot.TextOperation

describe('HollowStringFileData', function () {
  it('validates string length when edited', function () {
    const length = 200
    const fileData = new HollowStringFileData(length)

    expect(() => {
      fileData.edit(new TextOperation().retain(length + 10).insert('x'))
    }).to.throw(TextOperation.ApplyError)
    expect(fileData.getStringLength()).to.equal(length)

    fileData.edit(new TextOperation().retain(length).insert('x'))
    expect(fileData.getStringLength()).to.equal(length + 1)
  })
})
