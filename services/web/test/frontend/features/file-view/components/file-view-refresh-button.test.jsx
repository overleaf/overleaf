import {
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import FileViewRefreshButton from '@/features/file-view/components/file-view-refresh-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { USER_ID } from '../../../helpers/editor-providers'

describe('<FileViewRefreshButton />', function () {
  const projectFile = {
    name: 'example.tex',
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
      importer_id: USER_ID,
    },
    created: new Date(2021, 1, 17, 3, 24).toISOString(),
  }

  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  // eslint-disable-next-line mocha/no-skipped-tests
  it.skip('Changes text when the file is refreshing', async function () {
    fetchMock.post(
      'express:/project/:project_id/linked_file/:file_id/refresh',
      {
        new_file_id: '5ff7418157b4e144321df5c4',
      }
    )

    renderWithEditorContext(
      <FileViewRefreshButton
        file={projectFile}
        setRefreshError={sinon.stub()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitForElementToBeRemoved(() =>
      screen.getByText('Refreshing', { exact: false })
    )

    await screen.findByRole('button', { name: 'Refresh' })
  })
})
