import {
  screen,
  waitForElementToBeRemoved,
  fireEvent,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileView from '../../../../../frontend/js/features/file-view/components/file-view'
import { imageFile, textFile } from '../util/files'

describe('<FileView/>', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  describe('for a text file', function () {
    it('shows a loading indicator while the file is loading', async function () {
      fetchMock.head('express:/project/:project_id/blob/:hash', {
        status: 201,
        headers: { 'Content-Length': 10000 },
      })
      fetchMock.get(
        'express:/project/:project_id/blob/:hash',
        'Text file content'
      )

      renderWithEditorContext(<FileView file={textFile} />)

      await waitForElementToBeRemoved(() =>
        screen.getByTestId('loading-panel-file-view')
      )
    })

    it('shows messaging if the text view could not be loaded', async function () {
      const unpreviewableTextFile = {
        ...textFile,
        name: 'example.not-tex',
      }

      renderWithEditorContext(<FileView file={unpreviewableTextFile} />)

      await screen.findByText('Sorry, no preview is available', {
        exact: false,
      })
    })
  })

  describe('for an image file', function () {
    it('shows a loading indicator while the file is loading', async function () {
      renderWithEditorContext(<FileView file={imageFile} />)

      screen.getByTestId('loading-panel-file-view')
    })

    it('shows messaging if the image could not be loaded', async function () {
      renderWithEditorContext(<FileView file={imageFile} />)

      // Fake the image request failing as the request is handled by the browser
      fireEvent.error(screen.getByRole('img'))

      await screen.findByText('Sorry, no preview is available', {
        exact: false,
      })
    })
  })
})
