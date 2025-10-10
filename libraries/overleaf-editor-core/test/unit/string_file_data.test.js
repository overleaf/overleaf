// @ts-check
'use strict'

const { expect } = require('chai')
const _ = require('lodash')

const ot = require('../..')
const StringFileData = require('../../lib/file_data/string_file_data')
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

  it('getComments() should return an empty array', function () {
    const fileData = new StringFileData('test')
    expect(fileData.getComments().toRaw()).to.eql([])
  })

  it('creates StringFileData with comments', function () {
    const fileData = new StringFileData('test', [
      {
        id: 'comm1',
        ranges: [
          {
            pos: 5,
            length: 10,
          },
        ],
      },
      {
        id: 'comm2',
        ranges: [
          {
            pos: 20,
            length: 5,
          },
        ],
      },
    ])

    expect(fileData.getComments().toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
    ])
  })

  it('fromRaw() should create StringFileData with comments', function () {
    const fileData = StringFileData.fromRaw({
      content: 'test',
      comments: [
        {
          id: 'comm1',
          ranges: [
            {
              pos: 5,
              length: 10,
            },
          ],
        },
        {
          id: 'comm2',
          ranges: [
            {
              pos: 20,
              length: 5,
            },
          ],
          resolved: true,
        },
      ],
    })

    expect(fileData.getComments().toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }], resolved: true },
    ])
  })

  it('getContent should filter out tracked deletions when passed option', function () {
    const fileData = new StringFileData(
      'the quick brown fox jumps over the lazy dog',
      undefined,
      [
        {
          range: { pos: 4, length: 6 },
          tracking: {
            type: 'delete',
            ts: '2024-01-01T00:00:00.000Z',
            userId: 'user1',
          },
        },
        {
          range: { pos: 35, length: 5 },
          tracking: {
            type: 'delete',
            ts: '2023-01-01T00:00:00.000Z',
            userId: 'user2',
          },
        },
      ]
    )

    expect(fileData.getContent()).to.equal(
      'the quick brown fox jumps over the lazy dog'
    )
    expect(fileData.getContent({ filterTrackedDeletes: true })).to.equal(
      'the brown fox jumps over the dog'
    )
  })

  it('getContent should keep tracked insertions when passed option to remove tracked changes', function () {
    const fileData = new StringFileData(
      'the quick brown fox jumps over the lazy dog',
      undefined,
      [
        {
          range: { pos: 4, length: 6 },
          tracking: {
            type: 'insert',
            ts: '2024-01-01T00:00:00.000Z',
            userId: 'user1',
          },
        },
        {
          range: { pos: 35, length: 5 },
          tracking: {
            type: 'delete',
            ts: '2023-01-01T00:00:00.000Z',
            userId: 'user2',
          },
        },
      ]
    )

    expect(fileData.getContent()).to.equal(
      'the quick brown fox jumps over the lazy dog'
    )
    expect(fileData.getContent({ filterTrackedDeletes: true })).to.equal(
      'the quick brown fox jumps over the dog'
    )
  })
})
