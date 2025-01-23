import { screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import ActionsMenu from '../../../../../frontend/js/features/editor-left-menu/components/actions-menu'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<ActionsMenu />', function () {
  beforeEach(function () {
    fetchMock.post('express:/project/:projectId/compile', {
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
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu for non-anonymous users', async function () {
    window.metaAttributesCache.set('ol-anonymous', false)

    renderWithEditorContext(<ActionsMenu />, {
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

    screen.getByText('Actions')
    screen.getByRole('button', {
      name: 'Copy Project',
    })

    await waitFor(() => {
      screen.getByRole('button', {
        name: 'Word Count',
      })
    })
  })

  it('does not show anything for anonymous users', async function () {
    window.metaAttributesCache.set('ol-anonymous', true)

    renderWithEditorContext(<ActionsMenu />, {
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

    expect(screen.queryByText('Actions')).to.equal(null)
    expect(
      screen.queryByRole('button', {
        name: 'Copy Project',
      })
    ).to.equal(null)

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Word Count',
        })
      ).to.equal(null)
    })
  })
})
