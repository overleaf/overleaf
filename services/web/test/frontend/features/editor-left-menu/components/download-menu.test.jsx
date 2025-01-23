import { screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import DownloadMenu from '../../../../../frontend/js/features/editor-left-menu/components/download-menu'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<DownloadMenu />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows download links with correct url', async function () {
    fetchMock.post('express:/project/:projectId/compile', {
      clsiServerId: 'foo',
      compileGroup: 'priority',
      status: 'success',
      pdfDownloadDomain: 'https://clsi.test-overleaf.com',
      outputFiles: [
        {
          path: 'output.pdf',
          build: 'build-123',
          url: '/build/build-123/output.pdf',
          type: 'pdf',
        },
      ],
    })

    renderWithEditorContext(<DownloadMenu />, {
      projectId: '123abc',
      scope: {
        editor: {
          sharejs_doc: {
            doc_id: 'test-doc',
            getSnapshot: () => 'some doc content',
          },
        },
      },
    })

    const sourceLink = screen.getByRole('link', {
      name: 'Source',
    })

    expect(sourceLink.getAttribute('href')).to.equal(
      '/project/123abc/download/zip'
    )

    await waitFor(() => {
      const pdfLink = screen.getByRole('link', {
        name: 'PDF',
      })

      expect(pdfLink.getAttribute('href')).to.equal(
        '/download/project/123abc/build/build-123/output/output.pdf?compileGroup=priority&clsiserverid=foo&popupDownload=true'
      )
    })
  })
})
