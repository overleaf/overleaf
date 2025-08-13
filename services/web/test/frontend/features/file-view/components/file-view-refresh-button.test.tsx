import {
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import FileViewRefreshButton from '@/features/file-view/components/file-view-refresh-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { textFile } from '../util/files'

describe('<FileViewRefreshButton />', function () {
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
      <FileViewRefreshButton file={textFile} setRefreshError={sinon.stub()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitForElementToBeRemoved(() =>
      screen.getByText('Refreshing', { exact: false })
    )

    await screen.findByRole('button', { name: 'Refresh' })
  })
})
