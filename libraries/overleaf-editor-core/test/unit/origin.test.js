'use strict'

const { expect } = require('chai')
const {
  Change,
  Origin,
  RestoreFileOrigin,
  EDITOR_ORIGIN_KIND,
} = require('../..')
const schemas = require('../../lib/schemas')

describe('Origin', function () {
  const CLIENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('round trips a kind on its own', function () {
    const origin = new Origin('dropbox')
    // No key for an id nothing has: the shape of the stored origin is unchanged
    // for every writer that does not need recognising.
    expect(origin.toRaw()).to.deep.equal({ kind: 'dropbox' })
    expect(origin.getHistoryClientId()).to.be.undefined

    const parsed = Origin.fromRaw(origin.toRaw())
    expect(parsed.getKind()).to.equal('dropbox')
    expect(parsed.getHistoryClientId()).to.be.undefined
  })

  it('round trips a kind with the client that submitted it', function () {
    const origin = new Origin(EDITOR_ORIGIN_KIND, CLIENT_ID)
    expect(origin.toRaw()).to.deep.equal({
      kind: EDITOR_ORIGIN_KIND,
      historyClientId: CLIENT_ID,
    })

    const parsed = Origin.fromRaw(origin.toRaw())
    expect(parsed.getKind()).to.equal(EDITOR_ORIGIN_KIND)
    expect(parsed.getHistoryClientId()).to.equal(CLIENT_ID)
  })

  it('rejects a historyClientId that is not a non-empty string', function () {
    expect(() => new Origin(EDITOR_ORIGIN_KIND, '')).to.throw()
    expect(() => new Origin(EDITOR_ORIGIN_KIND, 42)).to.throw()
  })

  it('carries it on a kind of its own, not just the editor kind', function () {
    // What the id is for is recognising a change again, which is a property of
    // the client that submitted it rather than of what it did.
    const origin = new RestoreFileOrigin(
      7,
      'main.tex',
      new Date('2025-01-02T03:04:05.678Z'),
      CLIENT_ID
    )

    // Built up a layer at a time: the base writes the kind and the id, this one
    // adds what it owns.
    expect(origin.toRaw()).to.deep.equal({
      kind: 'file-restore',
      historyClientId: CLIENT_ID,
      version: 7,
      path: 'main.tex',
      timestamp: '2025-01-02T03:04:05.678Z',
    })

    const parsed = Origin.fromRaw(origin.toRaw())
    expect(parsed).to.be.an.instanceof(RestoreFileOrigin)
    expect(parsed.getHistoryClientId()).to.equal(CLIENT_ID)
    expect(parsed.getPath()).to.equal('main.tex')
  })

  describe('dropHistoryClientId', function () {
    it('leaves the rest of the origin behind', function () {
      const origin = new Origin(EDITOR_ORIGIN_KIND, CLIENT_ID)

      origin.dropHistoryClientId()

      expect(origin.getHistoryClientId()).to.be.undefined
      expect(origin.toRaw()).to.deep.equal({ kind: EDITOR_ORIGIN_KIND })
    })

    it('keeps the fields a subclass owns', function () {
      // What the chunk store does to every change but a client's latest, so a
      // restore that was submitted by a client stays a restore afterwards.
      const origin = new RestoreFileOrigin(
        7,
        'main.tex',
        new Date('2025-01-02T03:04:05.678Z'),
        CLIENT_ID
      )

      origin.dropHistoryClientId()

      expect(origin.toRaw()).to.deep.equal({
        kind: 'file-restore',
        version: 7,
        path: 'main.tex',
        timestamp: '2025-01-02T03:04:05.678Z',
      })
    })
  })

  describe('through a Change', function () {
    function changeWithOrigin(origin) {
      return Change.fromRaw({
        operations: [],
        timestamp: '2025-01-02T03:04:05.678Z',
        origin,
      })
    }

    it('carries the id while there is one', function () {
      const change = changeWithOrigin({
        kind: EDITOR_ORIGIN_KIND,
        historyClientId: CLIENT_ID,
      })

      expect(change.getOrigin().getHistoryClientId()).to.equal(CLIENT_ID)
      expect(change.toRaw().origin).to.deep.equal({
        kind: EDITOR_ORIGIN_KIND,
        historyClientId: CLIENT_ID,
      })
    })

    it('reads back a change whose id was stripped', function () {
      // Writing a chunk drops the id from all but a client's latest change,
      // leaving a bare {kind: 'editor'}, which still records where it came from.
      const change = changeWithOrigin({ kind: EDITOR_ORIGIN_KIND })

      expect(change.getOrigin().getKind()).to.equal(EDITOR_ORIGIN_KIND)
      expect(change.getOrigin().getHistoryClientId()).to.be.undefined
      expect(change.toRaw().origin).to.deep.equal({ kind: EDITOR_ORIGIN_KIND })
    })
  })

  describe('rawOrigin schema', function () {
    it('accepts a kind with a uuid', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          historyClientId: CLIENT_ID,
        }).success
      ).to.be.true
    })

    it('accepts the stripped form', function () {
      expect(schemas.rawOrigin.safeParse({ kind: EDITOR_ORIGIN_KIND }).success)
        .to.be.true
    })

    it('accepts one on a restore origin', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: 'file-restore',
          version: 7,
          path: 'main.tex',
          timestamp: '2025-01-02T03:04:05.678Z',
          historyClientId: CLIENT_ID,
        }).success
      ).to.be.true
    })

    it('rejects a kind with a shape of its own that does not match it', function () {
      // Without this the catch-all would take it: a change would store as a restore
      // that records nothing about what it restored, and be read back that way.
      expect(schemas.rawOrigin.safeParse({ kind: 'restore' }).success).to.be
        .false
      expect(
        schemas.rawOrigin.safeParse({ kind: 'file-restore', version: 1 })
          .success
      ).to.be.false
    })

    it('says which fields the kind a payload claims is missing', function () {
      // The named kinds discriminate on the kind, so a payload claiming one is
      // checked against that shape alone: the error is about what it got wrong,
      // rather than one guess per variant in the union.
      const result = schemas.rawOrigin.safeParse({
        kind: 'file-restore',
        version: 1,
      })

      const [claimed] = result.error.issues[0].errors
      expect(claimed.map(issue => issue.path.join('.'))).to.deep.equal([
        'path',
        'timestamp',
      ])
    })

    it('accepts a kind that has no shape of its own', function () {
      expect(schemas.rawOrigin.safeParse({ kind: 'dropbox' }).success).to.be
        .true
    })

    it('rejects a historyClientId that is not a uuid', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          historyClientId: 'not-a-uuid',
        }).success
      ).to.be.false
    })

    it('rejects unknown fields alongside the historyClientId', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          historyClientId: CLIENT_ID,
          somethingElse: 1,
        }).success
      ).to.be.false
    })
  })
})
