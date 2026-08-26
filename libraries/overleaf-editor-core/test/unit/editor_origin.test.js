'use strict'

const { expect } = require('chai')
const { Change, EditorOrigin, Origin, EDITOR_ORIGIN_KIND } = require('../..')
const schemas = require('../../lib/schemas')

describe('EditorOrigin', function () {
  const EDITOR_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('round trips through raw form', function () {
    const origin = new EditorOrigin(EDITOR_ID)
    expect(origin.toRaw()).to.deep.equal({
      kind: EDITOR_ORIGIN_KIND,
      editorId: EDITOR_ID,
    })

    const parsed = Origin.fromRaw(origin.toRaw())
    expect(parsed).to.be.an.instanceof(EditorOrigin)
    expect(parsed.getEditorId()).to.equal(EDITOR_ID)
    expect(parsed.getKind()).to.equal(EDITOR_ORIGIN_KIND)
  })

  it('rejects a missing editorId', function () {
    expect(() => new EditorOrigin()).to.throw()
    expect(() => new EditorOrigin('')).to.throw()
  })

  describe('once the editorId has been stripped', function () {
    // Writing a chunk drops the editorId from all but an editor's latest change,
    // leaving a bare {kind: 'editor'}. Reading one of those back has to keep
    // working, so it must not be treated as an EditorOrigin.
    it('parses as a plain Origin rather than throwing', function () {
      const parsed = Origin.fromRaw({ kind: EDITOR_ORIGIN_KIND })

      expect(parsed).to.be.an.instanceof(Origin)
      expect(parsed).to.not.be.an.instanceof(EditorOrigin)
      expect(parsed.getKind()).to.equal(EDITOR_ORIGIN_KIND)
      expect(parsed.toRaw()).to.deep.equal({ kind: EDITOR_ORIGIN_KIND })
    })

    it('survives a Change round trip', function () {
      const change = Change.fromRaw({
        operations: [],
        timestamp: '2025-01-02T03:04:05.678Z',
        origin: { kind: EDITOR_ORIGIN_KIND },
      })

      expect(change.getOrigin().getKind()).to.equal(EDITOR_ORIGIN_KIND)
      expect(change.toRaw().origin).to.deep.equal({ kind: EDITOR_ORIGIN_KIND })
    })
  })

  it('is carried through a Change round trip while it has an id', function () {
    const change = Change.fromRaw({
      operations: [],
      timestamp: '2025-01-02T03:04:05.678Z',
      origin: { kind: EDITOR_ORIGIN_KIND, editorId: EDITOR_ID },
    })

    expect(change.getOrigin()).to.be.an.instanceof(EditorOrigin)
    expect(change.getOrigin().getEditorId()).to.equal(EDITOR_ID)
    expect(change.toRaw().origin).to.deep.equal({
      kind: EDITOR_ORIGIN_KIND,
      editorId: EDITOR_ID,
    })
  })

  describe('rawOrigin schema', function () {
    it('accepts an editor origin with a uuid', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          editorId: EDITOR_ID,
        }).success
      ).to.be.true
    })

    it('accepts the stripped form', function () {
      expect(schemas.rawOrigin.safeParse({ kind: EDITOR_ORIGIN_KIND }).success)
        .to.be.true
    })

    it('rejects an editorId that is not a uuid', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          editorId: 'not-a-uuid',
        }).success
      ).to.be.false
    })

    it('rejects unknown fields alongside the editorId', function () {
      expect(
        schemas.rawOrigin.safeParse({
          kind: EDITOR_ORIGIN_KIND,
          editorId: EDITOR_ID,
          somethingElse: 1,
        }).success
      ).to.be.false
    })
  })
})
