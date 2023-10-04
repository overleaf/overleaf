import { screen } from '@testing-library/react'
import { expect } from 'chai'
import FileViewNotOriginalImporter from '@/features/file-view/components/file-view-not-original-importer'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { USER_ID } from '../../../helpers/editor-providers'

describe('<FileViewNotOriginalImporter />', function () {
  describe('provider is not mendeley and zotero', function () {
    it('does not show error if provider is not mendeley and zotero', function () {
      const urlFile: BinaryFile<'url'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'url',
          url: '/url/file.png',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'file.png',
        type: 'file',
        selected: true,
      }

      renderWithEditorContext(<FileViewNotOriginalImporter file={urlFile} />)

      const text = screen.queryByText(
        /Only the person who originally imported this/
      )

      expect(text).to.not.exist
    })
  })

  describe('provider is mendeley or zotero', function () {
    it('does not show error if current user is the original importer of the file', function () {
      const mendeleyFile: BinaryFile<'mendeley'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'mendeley',
          importer_id: USER_ID,
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'references.bib',
        type: 'file',
        selected: true,
      }

      renderWithEditorContext(
        <FileViewNotOriginalImporter file={mendeleyFile} />
      )

      const text = screen.queryByText(
        'Only the person who originally imported this Mendeley file can refresh it.'
      )

      expect(text).to.not.exist
    })

    it('shows error if provider is mendeley and current user is not the original importer of the file', function () {
      const mendeleyFile: BinaryFile<'mendeley'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'mendeley',
          importer_id: 'user123',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'references.bib',
        type: 'file',
        selected: true,
      }

      renderWithEditorContext(
        <FileViewNotOriginalImporter file={mendeleyFile} />
      )

      const text = screen.getByText(
        'Only the person who originally imported this Mendeley file can refresh it.'
      )

      expect(text).to.exist
    })

    it('shows error if provider is zotero and current user is not the original importer of the file', function () {
      const zoteroFile: BinaryFile<'zotero'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'zotero',
          importer_id: 'user123',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'references.bib',
        type: 'file',
        selected: true,
      }

      renderWithEditorContext(<FileViewNotOriginalImporter file={zoteroFile} />)

      const text = screen.getByText(
        'Only the person who originally imported this Zotero file can refresh it.'
      )

      expect(text).to.exist
    })
  })
})
