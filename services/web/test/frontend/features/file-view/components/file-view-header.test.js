import {
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewHeader from '../../../../../frontend/js/features/file-view/components/file-view-header.js'

describe('<FileViewHeader/>', function () {
  const urlFile = {
    name: 'example.tex',
    linkedFileData: {
      url: 'https://overleaf.com',
      provider: 'url',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  const projectFile = {
    name: 'example.tex',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
      importer_id: '123abd',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  const notOrignalImporterFile = {
    name: 'references.bib',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
      importer_id: '123abc',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  const projectOutputFile = {
    name: 'example.pdf',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_output_file_path: '/source-entity-path.ext',
      provider: 'project_output_file',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  const thirdPartyReferenceFile = {
    name: 'example.tex',
    linkedFileData: {
      provider: 'zotero',
      importer_id: '123abd',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  beforeEach(function () {
    fetchMock.reset()
  })

  describe('header text', function () {
    it('Renders the correct text for a file with the url provider', function () {
      renderWithEditorContext(
        <FileViewHeader file={urlFile} storeReferencesKeys={() => {}} />
      )
      screen.getByText('Imported from', { exact: false })
      screen.getByText('at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_file provider', function () {
      renderWithEditorContext(
        <FileViewHeader file={projectFile} storeReferencesKeys={() => {}} />
      )
      screen.getByText('Imported from', { exact: false })
      screen.getByText('Another project', { exact: false })
      screen.getByText('/source-entity-path.ext, at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_output_file provider', function () {
      renderWithEditorContext(
        <FileViewHeader
          file={projectOutputFile}
          storeReferencesKeys={() => {}}
        />
      )
      screen.getByText('Imported from the output of', { exact: false })
      screen.getByText('Another project', { exact: false })
      screen.getByText('/source-entity-path.ext, at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })
  })

  describe('The refresh button', async function () {
    it('Changes text when the file is refreshing', async function () {
      fetchMock.post(
        'express:/project/:project_id/linked_file/:file_id/refresh',
        {
          new_file_id: '5ff7418157b4e144321df5c4',
        }
      )

      renderWithEditorContext(
        <FileViewHeader file={projectFile} storeReferencesKeys={() => {}} />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh' })
      fireEvent.click(refreshButton)

      await waitForElementToBeRemoved(() =>
        screen.getByText('Refreshing', { exact: false })
      )

      await screen.findByText('Refresh')
    })

    it('Reindexes references after refreshing a file from a third-party provider', async function () {
      fetchMock.post(
        'express:/project/:project_id/linked_file/:file_id/refresh',
        {
          new_file_id: '5ff7418157b4e144321df5c4',
        }
      )

      const reindexResponse = {
        projectId: '123abc',
        keys: ['reference1', 'reference2', 'reference3', 'reference4'],
      }
      fetchMock.post(
        'express:/project/:project_id/references/indexAll',
        reindexResponse
      )

      const storeReferencesKeys = sinon.stub()

      renderWithEditorContext(
        <FileViewHeader
          file={thirdPartyReferenceFile}
          storeReferencesKeys={storeReferencesKeys}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh' })
      fireEvent.click(refreshButton)

      await waitForElementToBeRemoved(() =>
        screen.getByText('Refreshing', { exact: false })
      )

      expect(fetchMock.done()).to.be.true
      expect(storeReferencesKeys).to.have.been.calledWith(reindexResponse.keys)
    })

    it('Displays message when user is not original importer', function () {
      renderWithEditorContext(
        <FileViewHeader
          file={notOrignalImporterFile}
          storeReferencesKeys={() => {}}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh' })
      if (refreshButton.disabled) {
        const textBefore = screen.getByText(
          'Only the person who originally imported this',
          { exact: false }
        )
        expect(textBefore).to.exist

        const textAfter = screen.getByText('file can refresh it', {
          exact: false,
        })
        expect(textAfter).to.exist
      }
    })
  })

  describe('The download button', function () {
    it('exists', function () {
      renderWithEditorContext(
        <FileViewHeader file={urlFile} storeReferencesKeys={() => {}} />
      )

      screen.getByText('Download', { exact: false })
    })
  })
})
