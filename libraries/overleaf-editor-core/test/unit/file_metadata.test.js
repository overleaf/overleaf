// @ts-check
'use strict'

const { expect } = require('chai')

const {
  isDocumentMetadata,
  withDocumentMetadataFlag,
} = require('../../lib/file_metadata')

describe('file metadata', function () {
  describe('isDocumentMetadata', function () {
    it('accepts no metadata at all', function () {
      expect(isDocumentMetadata()).to.equal(true)
      expect(isDocumentMetadata({})).to.equal(true)
    })

    it('accepts the doc flags', function () {
      expect(isDocumentMetadata({ main: true })).to.equal(true)
      expect(isDocumentMetadata({ mainBibliography: true })).to.equal(true)
      expect(
        isDocumentMetadata({ main: true, mainBibliography: true })
      ).to.equal(true)
    })

    it('rejects metadata recording where the file came from', function () {
      expect(
        isDocumentMetadata({ importedAt: '2026-01-02T00:00:00.000Z' })
      ).to.equal(false)
      expect(isDocumentMetadata({ main: true, provider: 'zotero' })).to.equal(
        false
      )
    })
  })

  describe('withDocumentMetadataFlag', function () {
    it('sets a flag on metadata that has none', function () {
      expect(withDocumentMetadataFlag({}, 'mainBibliography', true)).to.eql({
        mainBibliography: true,
      })
    })

    it('keeps the other flag when setting one', function () {
      expect(
        withDocumentMetadataFlag({ main: true }, 'mainBibliography', true)
      ).to.eql({ main: true, mainBibliography: true })
    })

    it('keeps the other flag when clearing one', function () {
      expect(
        withDocumentMetadataFlag(
          { main: true, mainBibliography: true },
          'mainBibliography',
          false
        )
      ).to.eql({ main: true })
    })

    it('leaves a cleared flag out rather than setting it false', function () {
      expect(withDocumentMetadataFlag({ main: true }, 'main', false)).to.eql({})
    })

    it('drops metadata that is not a doc flag', function () {
      expect(
        withDocumentMetadataFlag(
          { main: true, importedAt: '2026-01-02T00:00:00.000Z' },
          'mainBibliography',
          true
        )
      ).to.eql({ main: true, mainBibliography: true })
    })
  })
})
