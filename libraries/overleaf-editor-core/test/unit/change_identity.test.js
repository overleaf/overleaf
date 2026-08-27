'use strict'

const { expect } = require('chai')
const {
  editorChangeIdentity,
  editorChangeIdentityOf,
  isSameEditorChange,
  isChangeFrom,
  EDITOR_ORIGIN_KIND,
} = require('../..')

const EDITOR_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const EDITOR_B = '9c858901-8a57-4791-81fe-4c455b099bc9'
const USER_A = '65b9d7fb2a1b2c3d4e5f6a7b'
const USER_B = '65b9d7fb2a1b2c3d4e5f6a7c'
const TIMESTAMP = '2025-01-02T03:04:05.678Z'

describe('editor change identity', function () {
  function raw(overrides = {}) {
    return {
      operations: [],
      timestamp: overrides.timestamp || TIMESTAMP,
      v2Authors: 'v2Authors' in overrides ? overrides.v2Authors : [USER_A],
      origin:
        'origin' in overrides
          ? overrides.origin
          : { kind: EDITOR_ORIGIN_KIND, historyClientId: EDITOR_A },
    }
  }

  function same(a, b) {
    return isSameEditorChange(editorChangeIdentity(a), editorChangeIdentity(b))
  }

  it('recognises the same change', function () {
    expect(same(raw(), raw())).to.be.true
  })

  describe('what it refuses to match', function () {
    // Each of these is a false match waiting to happen, and a false match means a
    // change is treated as a duplicate and silently discarded.

    it('a different editor sharing the author and timestamp', function () {
      // The case historyClientId exists for: two tabs of one user, or two anonymous
      // editors, can produce changes on the same millisecond.
      expect(
        same(
          raw(),
          raw({
            origin: { kind: EDITOR_ORIGIN_KIND, historyClientId: EDITOR_B },
          })
        )
      ).to.be.false
    })

    it('a different author sharing the historyClientId', function () {
      // historyClientId comes from the client, so a forged one must not let one account
      // suppress another's change.
      expect(same(raw(), raw({ v2Authors: [USER_B] }))).to.be.false
    })

    it('a different timestamp', function () {
      expect(same(raw(), raw({ timestamp: '2025-01-02T03:04:05.679Z' }))).to.be
        .false
    })

    it('a change from another writer', function () {
      expect(same(raw(), raw({ origin: { kind: 'dropbox' } }))).to.be.false
    })

    it('a change with no origin at all', function () {
      expect(same(raw(), raw({ origin: undefined }))).to.be.false
    })

    it('a change whose historyClientId was stripped when its chunk was written', function () {
      expect(same(raw(), raw({ origin: { kind: EDITOR_ORIGIN_KIND } }))).to.be
        .false
    })

    it('a change with more than one author', function () {
      // real-time stamps exactly one, so anything else did not come from there.
      expect(same(raw(), raw({ v2Authors: [USER_A, USER_B] }))).to.be.false
    })

    it('a change with no authors', function () {
      expect(same(raw(), raw({ v2Authors: [] }))).to.be.false
    })
  })

  describe('anonymous authors', function () {
    it('matches when both are anonymous from the same editor', function () {
      expect(same(raw({ v2Authors: [null] }), raw({ v2Authors: [null] }))).to.be
        .true
    })

    it('still separates two anonymous editors', function () {
      // They share an empty author, so the historyClientId is the only thing keeping
      // their changes apart.
      expect(
        same(
          raw({ v2Authors: [null] }),
          raw({
            v2Authors: [null],
            origin: { kind: EDITOR_ORIGIN_KIND, historyClientId: EDITOR_B },
          })
        )
      ).to.be.false
    })

    it('does not match an anonymous change against a signed-in one', function () {
      expect(same(raw({ v2Authors: [null] }), raw())).to.be.false
    })
  })

  describe('timestamps', function () {
    it('compares the instant rather than the spelling', function () {
      // The two sides serialise independently, so equal instants must match even
      // if the strings differ.
      expect(
        same(
          raw({ timestamp: '2025-01-02T03:04:05.678Z' }),
          raw({
            timestamp: '2025-01-02T04:04:05.678+01:00',
          })
        )
      ).to.be.true
    })

    it('refuses an unparseable timestamp', function () {
      expect(editorChangeIdentity(raw({ timestamp: 'not a date' }))).to.be.null
    })
  })

  describe('editorChangeIdentityOf', function () {
    it('matches a raw change describing the same submission', function () {
      const mine = editorChangeIdentityOf({
        historyClientId: EDITOR_A,
        author: USER_A,
        timestamp: new Date(TIMESTAMP),
      })

      expect(isSameEditorChange(mine, editorChangeIdentity(raw()))).to.be.true
    })

    it('treats a missing author as anonymous', function () {
      const mine = editorChangeIdentityOf({
        historyClientId: EDITOR_A,
        author: null,
        timestamp: new Date(TIMESTAMP),
      })

      expect(
        isSameEditorChange(
          mine,
          editorChangeIdentity(raw({ v2Authors: [null] }))
        )
      ).to.be.true
    })
  })

  it('never matches a null identity, including against another null', function () {
    expect(isSameEditorChange(null, null)).to.be.false
    expect(isSameEditorChange(editorChangeIdentity(raw()), null)).to.be.false
  })
})

describe('isChangeFrom', function () {
  const KIND = 'github'

  function raw(overrides = {}) {
    return {
      operations: [],
      timestamp: overrides.timestamp || TIMESTAMP,
      v2Authors: 'v2Authors' in overrides ? overrides.v2Authors : [USER_A],
      origin: 'origin' in overrides ? overrides.origin : { kind: KIND },
    }
  }

  const expected = {
    originKind: KIND,
    author: USER_A,
    timestamp: new Date(TIMESTAMP),
  }

  it('recognises a change this writer placed', function () {
    expect(isChangeFrom(raw(), expected)).to.be.true
  })

  it('recognises it among several authors', function () {
    expect(isChangeFrom(raw({ v2Authors: [USER_B, USER_A] }), expected)).to.be
      .true
  })

  it('compares the timestamp as a point in time', function () {
    // two spellings of the same instant are the same change
    expect(
      isChangeFrom(
        raw({ timestamp: '2025-01-02T04:04:05.678+01:00' }),
        expected
      )
    ).to.be.true
  })

  describe('what it refuses to match', function () {
    // a false match here has the writer take a commit it never landed as landed, and the removes it holds are never applied

    it('a kind another writer stamps', function () {
      expect(isChangeFrom(raw({ origin: { kind: 'dropbox' } }), expected)).to.be
        .false
    })

    it('a change with no origin', function () {
      expect(isChangeFrom(raw({ origin: undefined }), expected)).to.be.false
    })

    it('a change placed on behalf of another user', function () {
      expect(isChangeFrom(raw({ v2Authors: [USER_B] }), expected)).to.be.false
    })

    it('a change with no authors recorded', function () {
      expect(isChangeFrom(raw({ v2Authors: undefined }), expected)).to.be.false
      expect(isChangeFrom(raw({ v2Authors: [] }), expected)).to.be.false
    })

    it('a change from another moment', function () {
      expect(
        isChangeFrom(raw({ timestamp: '2025-01-02T03:04:05.679Z' }), expected)
      ).to.be.false
    })

    it('an unparseable timestamp', function () {
      expect(isChangeFrom(raw({ timestamp: 'not a date' }), expected)).to.be
        .false
    })

    it('nothing at all on either side', function () {
      expect(isChangeFrom(undefined, expected)).to.be.false
      expect(isChangeFrom(raw(), undefined)).to.be.false
    })
  })
})
