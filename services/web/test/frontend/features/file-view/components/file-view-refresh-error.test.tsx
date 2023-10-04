import { render, screen } from '@testing-library/react'
import FileViewRefreshError from '@/features/file-view/components/file-view-refresh-error'
import type { BinaryFile } from '@/features/file-view/types/binary-file'
import { expect } from 'chai'

describe('<FileViewRefreshError />', function () {
  describe('<FileViewMendeleyOrZoteroRefreshError />', function () {
    it('shows correct error message for mendeley', async function () {
      const mendeleyFile: BinaryFile<'mendeley'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'mendeley',
          importer_id: 'user123456',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'references.bib',
        type: 'file',
        selected: true,
      }

      render(
        <FileViewRefreshError
          file={mendeleyFile}
          refreshError="error_message"
        />
      )

      screen.getByText(/Something’s not right!/)
      screen.getByText(
        /It looks like you need to re-link your Mendeley account./
      )

      const goToSettingsLink = screen.getByRole('link', {
        name: 'Go to settings',
      })

      expect(goToSettingsLink.getAttribute('href')).to.equal('/user/settings')
    })

    it('shows correct error message for zotero', async function () {
      const zoteroFile: BinaryFile<'zotero'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'zotero',
          importer_id: 'user123456',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'references.bib',
        type: 'file',
        selected: true,
      }

      render(
        <FileViewRefreshError file={zoteroFile} refreshError="error_message" />
      )

      screen.getByText(/Something’s not right!/)
      screen.getByText(/It looks like you need to re-link your Zotero account./)

      const goToSettingsLink = screen.getByRole('link', {
        name: 'Go to settings',
      })

      expect(goToSettingsLink.getAttribute('href')).to.equal('/user/settings')
    })
  })

  describe('<FileViewDefaultRefreshError />', function () {
    it('shows correct error message', function () {
      const anotherProjectFile: BinaryFile<'project_file'> = {
        id: '123abc',
        _id: '123abc',
        linkedFileData: {
          provider: 'project_file',
          source_project_id: 'some-id',
          source_entity_path: '/path/',
        },
        created: new Date(2023, 1, 17, 3, 24),
        name: 'frog.jpg',
        type: 'file',
        selected: true,
      }

      render(
        <FileViewRefreshError
          file={anotherProjectFile}
          refreshError="An error message"
        />
      )

      screen.getByText('Access Denied: An error message')
    })
  })
})
