'use strict'

const { expect } = require('chai')
const _ = require('lodash')

const ot = require('..')
const StringFileData = require('../lib/file_data/string_file_data')
const TextOperation = ot.TextOperation

describe('StringFileData', function () {
  it('throws when it contains non BMP chars', function () {
    const content = '𝌆𝌆𝌆'
    const fileData = new StringFileData(content)
    const operation = new TextOperation()
    operation.insert('aa')
    expect(() => {
      fileData.edit(operation)
    }).to.throw(TextOperation.ApplyError, /string contains non BMP characters/)
  })

  it('validates string length when edited', function () {
    const longString = _.repeat('a', TextOperation.MAX_STRING_LENGTH)
    const fileData = new StringFileData(longString)
    expect(fileData.getByteLength()).to.equal(longString.length)
    expect(fileData.getStringLength()).to.equal(longString.length)

    expect(() => {
      fileData.edit(new TextOperation().retain(longString.length).insert('x'))
    }).to.throw(TextOperation.TooLongError)
    expect(fileData.getByteLength()).to.equal(longString.length)
    expect(fileData.getStringLength()).to.equal(longString.length)

    fileData.edit(new TextOperation().retain(longString.length - 1).remove(1))
    expect(fileData.getByteLength()).to.equal(longString.length - 1)
    expect(fileData.getStringLength()).to.equal(longString.length - 1)
  })
})
