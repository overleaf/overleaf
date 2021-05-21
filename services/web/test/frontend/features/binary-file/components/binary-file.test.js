import React from 'react'
import {
  screen,
  waitForElementToBeRemoved,
  fireEvent,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import BinaryFile from '../../../../../frontend/js/features/binary-file/components/binary-file.js'

describe('<BinaryFile/>', function () {
  const textFile = {
    name: 'example.tex',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  const imageFile = {
    id: '60097ca20454610027c442a8',
    name: 'file.jpg',
    linkedFileData: {
      source_entity_path: '/source-entity-path',
      provider: 'project_file',
    },
  }

  beforeEach(function () {
    fetchMock.reset()
  })

  describe('for a text file', function () {
    it('shows a loading indicator while the file is loading', async function () {
      renderWithEditorContext(
        <BinaryFile file={textFile} storeReferencesKeys={() => {}} />
      )

      await waitForElementToBeRemoved(() =>
        screen.getByText('Loading', { exact: false })
      )
    })

    it('shows messaging if the text view could not be loaded', async function () {
      renderWithEditorContext(
        <BinaryFile file={textFile} storeReferencesKeys={() => {}} />
      )

      await screen.findByText('Sorry, no preview is available', {
        exact: false,
      })
    })
  })

  describe('for an image file', function () {
    it('shows a loading indicator while the file is loading', async function () {
      renderWithEditorContext(
        <BinaryFile file={imageFile} storeReferencesKeys={() => {}} />
      )

      screen.getByText('Loading', { exact: false })
    })

    it('shows messaging if the image could not be loaded', function () {
      renderWithEditorContext(
        <BinaryFile file={imageFile} storeReferencesKeys={() => {}} />
      )

      // Fake the image request failing as the request is handled by the browser
      fireEvent.error(screen.getByRole('img'))

      screen.findByText('Sorry, no preview is available', { exact: false })
    })
  })
})
