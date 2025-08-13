import { screen } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewHeader from '../../../../../frontend/js/features/file-view/components/file-view-header'
import { USER_ID } from '../../../helpers/editor-providers'
import { fileViewFile } from '@/features/ide-react/util/file-view'
import { projectOutputFile, textFile, urlFile } from '../util/files'

describe('<FileViewHeader/>', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  describe('header text', function () {
    it('Renders the correct text for a file with the url provider', function () {
      renderWithEditorContext(<FileViewHeader file={urlFile} />)
      screen.getByText('Imported from', { exact: false })
      screen.getByText('at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_file provider', function () {
      renderWithEditorContext(<FileViewHeader file={textFile} />)
      screen.getByText('Imported from', { exact: false })
      screen.getByText('Another project', { exact: false })
      screen.getByText('/source-entity-path.ext, at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })

    it('Renders the correct text for a file with the project_output_file provider', function () {
      renderWithEditorContext(<FileViewHeader file={projectOutputFile} />)
      screen.getByText('Imported from the output of', { exact: false })
      screen.getByText('Another project', { exact: false })
      screen.getByText('/source-entity-path.ext, at 3:24 am Wed, 17th Feb 21', {
        exact: false,
      })
    })
  })

  describe('The download button', function () {
    it('exists', function () {
      renderWithEditorContext(<FileViewHeader file={urlFile} />)

      screen.getByText('Download')
    })
  })

  it('should use importedAt as timestamp when present in the linked file data', function () {
    const fileFromServer = {
      _id: 'some-id',
      hash: 'some-hash',
      name: 'example.tex',
      linkedFileData: {
        v1_source_doc_id: 'v1-source-id',
        source_project_id: 'source-project-id',
        source_entity_path: '/source-entity-path.ext',
        provider: 'project_file',
        importer_id: USER_ID,
        importedAt: new Date(2024, 8, 16, 1, 30).getTime(),
      },
      created: new Date(2021, 1, 17, 3, 24).toISOString(),
    }
    // FIXME: This should be tested through the <EditorAndPdf /> component instead
    const fileShown = fileViewFile(fileFromServer)
    renderWithEditorContext(<FileViewHeader file={fileShown} />)
    screen.getByText('Imported from', { exact: false })
    screen.getByText('Another project', { exact: false })
    screen.getByText('/source-entity-path.ext, at 1:30 am Mon, 16th Sep 24', {
      exact: false,
    })
  })
})
