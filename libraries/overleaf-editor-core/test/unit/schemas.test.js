const { expect } = require('chai')
const {
  rawLinkedFileData,
  rawFileMetadata,
  rawRetainOp,
  rawTextOperation,
} = require('../../lib/schemas')

describe('schemas', function () {
  describe('rawTextOperation', function () {
    it('accepts a no-op TextOperation', function () {
      const result = rawTextOperation.safeParse({
        textOperation: [],
      })
      expect(result.success).to.equal(true)
    })
  })

  describe('rawRetainOp', function () {
    it('accepts a bare retain length', function () {
      const result = rawRetainOp.safeParse(5)
      expect(result.success).to.equal(true)
    })

    it('accepts a retain with tracked-insert props', function () {
      const result = rawRetainOp.safeParse({
        r: 5,
        tracking: {
          type: 'insert',
          userId: '507f1f77bcf86cd799439011',
          ts: '2024-01-01T00:00:00.000Z',
        },
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a retain with clear-tracking props', function () {
      const result = rawRetainOp.safeParse({
        r: 5,
        tracking: { type: 'none' },
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a retain with an unrecognized tracking type', function () {
      const result = rawRetainOp.safeParse({
        r: 5,
        tracking: { type: 'not-a-tracking-type' },
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a retain with a malformed tracking userId', function () {
      const result = rawRetainOp.safeParse({
        r: 5,
        tracking: {
          type: 'insert',
          userId: 'not-an-object-id',
          ts: '2024-01-01T00:00:00.000Z',
        },
      })
      expect(result.success).to.equal(false)
    })
  })

  describe('rawLinkedFileData', function () {
    it('rejects an empty object', function () {
      const result = rawLinkedFileData.safeParse({})
      expect(result.success).to.equal(false)
    })

    it('rejects an unrecognized provider', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'not-a-provider',
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a project_file provider with an unrecognized extra key', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        source_entity_path: '/main.tex',
        extraUnrecognizedKey: 'abcd',
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a project_file provider with a valid source_project_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        source_project_id: '507f1f77bcf86cd799439011',
        source_entity_path: '/main.tex',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a project_file provider with a missing source_project_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        source_entity_path: '/main.tex',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a project_file provider with a v1 source doc id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        v1_source_doc_id: 1234,
        source_entity_path: '/main.tex',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a project_file provider with a legacy display name', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        v1_source_doc_id: 1234,
        source_entity_path: '/main.tex',
        source_project_display_name: 'My linked project',
        importedAt: '2017-05-04T00:00:00.000Z',
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a project_file provider with a malformed source_project_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_file',
        source_project_id: 'not-an-object-id',
        source_entity_path: '/main.tex',
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a project_output_file provider with a valid source_project_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        source_project_id: '507f1f77bcf86cd799439011',
        source_output_file_path: 'output.pdf',
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a project_output_file provider with a malformed source_project_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        source_project_id: 'not-an-object-id',
        source_output_file_path: 'output.pdf',
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a project_output_file provider with a v1 source doc id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        v1_source_doc_id: 1234,
        source_output_file_path: 'output.pdf',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a project_output_file provider with a valid build_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        source_output_file_path: 'output.pdf',
        build_id: '1234-abcd',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a project_output_file provider with verbose details', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        source_project_id: '507f1f77bcf86cd799439011',
        source_output_file_path: 'output.pdf',
        compileGroup: 'standard',
        clsiServerId: 'clsi-pre-emp-e2-f-tqnd',
        build_id: '1234-abcd',
        importedAt: '2026-08-14T00:00:00.000Z',
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a project_output_file provider with a malformed build_id', function () {
      const result = rawLinkedFileData.safeParse({
        provider: 'project_output_file',
        source_output_file_path: 'output.pdf',
        build_id: 'not-a-valid-build-id',
      })
      expect(result.success).to.equal(false)
    })

    for (const provider of ['mendeley', 'zotero', 'papers']) {
      it(`accepts a ${provider} provider with an opaque group_id`, function () {
        const result = rawLinkedFileData.safeParse({
          provider,
          group_id: 'abcd',
        })
        expect(result.success).to.equal(true)
      })

      it(`accepts a ${provider} provider with a missing group_id`, function () {
        const result = rawLinkedFileData.safeParse({ provider })
        expect(result.success).to.equal(true)
      })

      it(`accepts a ${provider} provider with a null group_id`, function () {
        const result = rawLinkedFileData.safeParse({
          provider,
          group_id: null,
        })
        expect(result.success).to.equal(true)
      })

      it(`rejects a ${provider} provider with a group_id containing a path separator`, function () {
        const result = rawLinkedFileData.safeParse({
          provider,
          group_id: 'abcd/../../etc/passwd',
        })
        expect(result.success).to.equal(false)
      })

      it(`rejects a ${provider} provider with a group_id of ".."`, function () {
        const result = rawLinkedFileData.safeParse({
          provider,
          group_id: '..',
        })
        expect(result.success).to.equal(false)
      })
    }
  })

  describe('rawFileMetadata', function () {
    it('accepts a legacy v1 main flag', function () {
      const result = rawFileMetadata.safeParse({
        main: true,
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy v1 url import', function () {
      const result = rawFileMetadata.safeParse({
        agent: 'url',
        agentDataId: 42,
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy v1 wlfile import', function () {
      const result = rawFileMetadata.safeParse({
        agent: 'wlfile',
        agentDataId: 1337,
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy v1 main flag with an importedAt timestamp', function () {
      const result = rawFileMetadata.safeParse({
        main: true,
        importedAt: '2024-01-01T00:00:00.000Z',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts linked-file metadata for a v1 project_file import', function () {
      const result = rawFileMetadata.safeParse({
        importedAt: '2024-01-01T00:00:00.000Z',
        provider: 'project_file',
        v1_source_doc_id: 1234,
        source_entity_path: '/main.tex',
      })
      expect(result.success).to.equal(true)
    })

    it('accepts an importedAt timestamp with no provider', function () {
      const result = rawFileMetadata.safeParse({
        importedAt: '2024-01-01T00:00:00.000Z',
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a malformed importedAt timestamp with no provider', function () {
      const result = rawFileMetadata.safeParse({
        importedAt: 'not-a-date',
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a main bibliography flag', function () {
      const result = rawFileMetadata.safeParse({
        mainBibliography: true,
      })
      expect(result.success).to.equal(true)
    })

    it('accepts both doc flags on one file', function () {
      const result = rawFileMetadata.safeParse({
        main: true,
        mainBibliography: true,
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a doc flag that is not a boolean', function () {
      const result = rawFileMetadata.safeParse({
        mainBibliography: 'yes',
      })
      expect(result.success).to.equal(false)
    })

    it('accepts an empty object', function () {
      const result = rawFileMetadata.safeParse({})
      expect(result.success).to.equal(true)
    })
  })
})
