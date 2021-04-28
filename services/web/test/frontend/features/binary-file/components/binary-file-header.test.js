import React from 'react'
import {
  render,
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'

import BinaryFileHeader from '../../../../../frontend/js/features/binary-file/components/binary-file-header.js'

describe('<BinaryFileHeader/>', function () {
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
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  let storeReferencesKeys

  beforeEach(function () {
    fetchMock.reset()
    storeReferencesKeys = sinon.stub()
  })

  describe('header text', function () {
    it('Renders the correct text for a file with the url provider', function () {
      render(<BinaryFileHeader file={urlFile} storeReferencesKeys={() => {}} />)
      screen.getByText('Imported from', { exact: false })
      screen.getByText('at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_file provider', function () {
      render(
        <BinaryFileHeader file={projectFile} storeReferencesKeys={() => {}} />
      )
      screen.getByText('Imported from', { exact: false })
      screen.getByText('Another project', { exact: false })
      screen.getByText('/source-entity-path.ext, at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_output_file provider', function () {
      render(
        <BinaryFileHeader
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
    let reindexResponse

    beforeEach(function () {
      window.project_id = '123abc'
      reindexResponse = {
        projectId: '123abc',
        keys: ['reference1', 'reference2', 'reference3', 'reference4'],
      }
    })

    afterEach(function () {
      delete window.project_id
    })

    it('Changes text when the file is refreshing', async function () {
      fetchMock.post(
        'express:/project/:project_id/linked_file/:file_id/refresh',
        {
          new_file_id: '5ff7418157b4e144321df5c4',
        }
      )

      render(
        <BinaryFileHeader file={projectFile} storeReferencesKeys={() => {}} />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

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

      fetchMock.post(
        'express:/project/:project_id/references/indexAll',
        reindexResponse
      )

      render(
        <BinaryFileHeader
          file={thirdPartyReferenceFile}
          storeReferencesKeys={storeReferencesKeys}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

      await waitForElementToBeRemoved(() =>
        screen.getByText('Refreshing', { exact: false })
      )

      expect(fetchMock.done()).to.be.true
      expect(storeReferencesKeys).to.be.calledWith(reindexResponse.keys)
    })
  })

  describe('The download button', function () {
    it('exists', function () {
      render(<BinaryFileHeader file={urlFile} storeReferencesKeys={() => {}} />)

      screen.getByText('Download', { exact: false })
    })
  })
})
