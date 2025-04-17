import { screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import ActionsWordCount from '../../../../../frontend/js/features/editor-left-menu/components/actions-word-count'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<ActionsWordCount />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct modal when clicked after document is compiled', async function () {
    const compileEndpoint = 'express:/project/:projectId/compile'
    const wordcountEndpoint = 'express:/project/:projectId/wordcount'

    fetchMock.post(compileEndpoint, {
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

    fetchMock.get(wordcountEndpoint, {
      texcount: {
        encode: 'ascii',
        textWords: 0,
        headers: 0,
        mathInline: 0,
        mathDisplay: 0,
      },
    })

    renderWithEditorContext(<ActionsWordCount />, {
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

    // when loading, we don't render the "Word Count" as button yet
    expect(screen.queryByRole('button', { name: 'Word Count' })).to.equal(null)

    await waitFor(
      () => expect(fetchMock.callHistory.called(compileEndpoint)).to.be.true
    )

    const button = await screen.findByRole('button', { name: 'Word Count' })
    button.click()

    await waitFor(
      () => expect(fetchMock.callHistory.called(wordcountEndpoint)).to.be.true
    )
  })
})
