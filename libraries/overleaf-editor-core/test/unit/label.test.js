'use strict'

const { expect } = require('chai')
const ot = require('../..')
const Label = ot.Label

describe('Label', function () {
  it('can be created by an anonymous author', function () {
    const label = Label.fromRaw({
      text: 'test',
      authorId: null,
      timestamp: '2016-01-01T00:00:00Z',
      version: 123,
    })
    expect(label.getAuthorId()).to.be.null
  })
})
