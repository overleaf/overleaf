import { screen } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewText from '../../../../../frontend/js/features/file-view/components/file-view-text'

describe('<FileViewText/>', function () {
  const file = {
    id: '123',
    hash: '1234',
    name: 'example.tex',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  beforeEach(function () {
    fetchMock.reset()
  })

  it('renders a text view', async function () {
    fetchMock.head('express:/project/:project_id/blob/:hash', {
      status: 201,
      headers: { 'Content-Length': 10000 },
    })
    fetchMock.get(
      'express:/project/:project_id/blob/:hash',
      'Text file content'
    )

    renderWithEditorContext(
      <FileViewText file={file} onError={() => {}} onLoad={() => {}} />
    )

    await screen.findByText('Text file content', { exact: false })
  })
})
