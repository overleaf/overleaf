import '../../../../helpers/bootstrap-3'
import { useEffect } from 'react'
import FileTreeModalCreateFile from '../../../../../../frontend/js/features/file-tree/components/modals/file-tree-modal-create-file'
import { useFileTreeActionable } from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-actionable'
import { useFileTreeData } from '../../../../../../frontend/js/shared/context/file-tree-data-context'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { FileTreeProvider } from '../../helpers/file-tree-provider'
import getMeta from '@/utils/meta'

describe('<FileTreeModalCreateFile/>', function () {
  it('handles invalid file names', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').as('input')
    cy.findByRole('button', { name: 'Create' }).as('submit')

    cy.get('@input').should('have.value', 'name.tex')
    cy.get('@submit').should('not.be.disabled')
    cy.findByRole('alert').should('not.exist')

    cy.get('@input').clear()
    cy.get('@submit').should('be.disabled')
    cy.findByRole('alert').should('contain.text', 'File name is empty')

    cy.get('@input').type('test.tex')
    cy.get('@submit').should('not.be.disabled')
    cy.findByRole('alert').should('not.exist')

    cy.get('@input').type('oops/i/did/it/again')
    cy.get('@submit').should('be.disabled')
    cy.findByRole('alert').should('contain.text', 'contains invalid characters')
  })

  it('displays an error when the file limit is reached', function () {
    getMeta('ol-ExposedSettings').maxEntitiesPerProject = 10

    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: Array.from({ length: 10 }, (_, index) => ({
          _id: `entity-${index}`,
        })),
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('alert')
      .invoke('text')
      .should('match', /This project has reached the \d+ file limit/)
  })

  it('displays a warning when the file limit is nearly reached', function () {
    getMeta('ol-ExposedSettings').maxEntitiesPerProject = 10

    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: Array.from({ length: 9 }, (_, index) => ({
          _id: `entity-${index}`,
        })),
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByText(/This project is approaching the file limit \(\d+\/\d+\)/)
  })

  it('counts files in nested folders', function () {
    getMeta('ol-ExposedSettings').maxEntitiesPerProject = 10

    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: 'doc-1' }],
        fileRefs: [],
        folders: [
          {
            docs: [{ _id: 'doc-2' }],
            fileRefs: [],
            folders: [
              {
                docs: [
                  { _id: 'doc-3' },
                  { _id: 'doc-4' },
                  { _id: 'doc-5' },
                  { _id: 'doc-6' },
                  { _id: 'doc-7' },
                ],
                fileRefs: [],
                folders: [],
              },
            ],
          },
        ],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByText(/This project is approaching the file limit \(\d+\/\d+\)/)
  })

  it('counts folders toward the limit', function () {
    getMeta('ol-ExposedSettings').maxEntitiesPerProject = 10

    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: 'doc-1' }],
        fileRefs: [],
        folders: [
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
          { docs: [], fileRefs: [], folders: [] },
        ],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByText(/This project is approaching the file limit \(\d+\/\d+\)/)
  })

  it('creates a new file when the form is submitted', function () {
    cy.intercept('post', '/project/*/doc', {
      statusCode: 204,
    }).as('createDoc')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').type('test')
    cy.findByRole('button', { name: 'Create' }).click()

    cy.wait('@createDoc')

    cy.get('@createDoc').its('request.body').should('deep.equal', {
      parent_folder_id: 'root-folder-id',
      name: 'test.tex',
    })
  })

  it('imports a new file from a project', function () {
    getMeta('ol-ExposedSettings').hasLinkedProjectFileFeature = true
    getMeta('ol-ExposedSettings').hasLinkedProjectOutputFileFeature = true

    cy.intercept('/user/projects', {
      body: {
        projects: [
          {
            _id: 'test-project',
            name: 'This Project',
          },
          {
            _id: 'project-1',
            name: 'Project One',
          },
          {
            _id: 'project-2',
            name: 'Project Two',
          },
        ],
      },
    })

    cy.intercept('/project/*/entities', {
      body: {
        entities: [
          {
            path: '/foo.tex',
          },
          {
            path: '/bar.tex',
          },
        ],
      },
    })

    cy.intercept('post', '/project/*/compile', {
      body: {
        status: 'success',
        outputFiles: [
          {
            build: 'test',
            path: 'baz.jpg',
          },
          {
            build: 'test',
            path: 'ball.jpg',
          },
        ],
      },
    })

    cy.intercept('post', '/project/*/linked_file', {
      statusCode: 204,
    }).as('createLinkedFile')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="project" />
        </FileTreeProvider>
      </EditorProviders>
    )

    // initial state, no project selected
    cy.findByLabelText('Select a Project').should('not.be.disabled')

    // the submit button should be disabled
    cy.findByRole('button', { name: 'Create' }).should('be.disabled')

    // the source file selector should be disabled
    cy.findByLabelText('Select a File').should('be.disabled')
    cy.findByLabelText('Select an Output File').should('not.exist')
    // TODO: check for options length, excluding current project

    // select a project
    cy.findByLabelText('Select a Project').select('project-2')

    // wait for the source file selector to be enabled
    cy.findByLabelText('Select a File').should('not.be.disabled')
    cy.findByLabelText('Select an Output File').should('not.exist')
    cy.findByRole('button', { name: 'Create' }).should('be.disabled')

    // TODO: check for fileInput options length, excluding current project

    // click on the button to toggle between source and output files
    cy.findByRole('button', {
      // NOTE: When changing the label, update the other tests with this label as well.
      name: 'select from output files',
    }).click()

    // wait for the output file selector to be enabled
    cy.findByLabelText('Select an Output File').should('not.be.disabled')
    cy.findByLabelText('Select a File').should('not.exist')
    cy.findByRole('button', { name: 'Create' }).should('be.disabled')

    // TODO: check for entityInput options length, excluding current project
    cy.findByLabelText('Select an Output File').select('ball.jpg')
    cy.findByRole('button', { name: 'Create' }).should('not.be.disabled')
    cy.findByRole('button', { name: 'Create' }).click()

    cy.get('@createLinkedFile')
      .its('request.body')
      .should('deep.equal', {
        name: 'ball.jpg',
        provider: 'project_output_file',
        parent_folder_id: 'root-folder-id',
        data: {
          source_project_id: 'project-2',
          source_output_file_path: 'ball.jpg',
          build_id: 'test',
        },
      })
  })

  describe('when the output files feature is not available', function () {
    beforeEach(function () {
      getMeta('ol-ExposedSettings').hasLinkedProjectFileFeature = true
      getMeta('ol-ExposedSettings').hasLinkedProjectOutputFileFeature = false
    })

    it('should not show the import from output file mode', function () {
      cy.intercept('/user/projects', {
        body: {
          projects: [
            {
              _id: 'test-project',
              name: 'This Project',
            },
            {
              _id: 'project-1',
              name: 'Project One',
            },
            {
              _id: 'project-2',
              name: 'Project Two',
            },
          ],
        },
      })

      cy.mount(
        <EditorProviders>
          <FileTreeProvider>
            <OpenWithMode mode="project" />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByLabelText('Select a File')

      cy.findByRole('button', {
        name: 'select from output files',
      }).should('not.exist')
    })
  })

  it('import from a URL when the form is submitted', function () {
    cy.intercept('/project/*/linked_file', {
      statusCode: 204,
    }).as('createLinkedFile')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="url" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('URL to fetch the file from').type(
      'https://example.com/example.tex'
    )
    cy.findByLabelText('File Name In This Project').should(
      'have.value',
      'example.tex'
    )

    // check that the name can still be edited manually
    cy.findByLabelText('File Name In This Project').clear()
    cy.findByLabelText('File Name In This Project').type('test.tex')
    cy.findByLabelText('File Name In This Project').should(
      'have.value',
      'test.tex'
    )

    cy.findByRole('button', { name: 'Create' }).click()

    cy.get('@createLinkedFile')
      .its('request.body')
      .should('deep.equal', {
        name: 'test.tex',
        provider: 'url',
        parent_folder_id: 'root-folder-id',
        data: { url: 'https://example.com/example.tex' },
      })
  })

  it('uploads a dropped file', function () {
    cy.intercept('post', '/project/*/upload?folder_id=root-folder-id', {
      statusCode: 204,
    }).as('uploadFile')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="upload" />
        </FileTreeProvider>
      </EditorProviders>
    )

    // the submit button should not be present
    cy.findByRole('button', { name: 'Create' }).should('not.exist')

    cy.get('input[type=file]')
      .eq(0)
      .selectFile(
        {
          contents: Cypress.Buffer.from('test'),
          fileName: 'test.tex',
          mimeType: 'text/plain',
          lastModified: Date.now(),
        },
        {
          action: 'drag-drop',
          force: true, // invisible element
        }
      )

    cy.wait('@uploadFile')
  })

  it('uploads a pasted file', function () {
    cy.intercept('post', '/project/*/upload?folder_id=root-folder-id', {
      statusCode: 204,
    }).as('uploadFile')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="upload" />
        </FileTreeProvider>
      </EditorProviders>
    )

    // the submit button should not be present
    cy.findByRole('button', { name: 'Create' }).should('not.exist')

    cy.wrap(null).then(() => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(
        new File(['test'], 'test.tex', { type: 'text/plain' })
      )
      cy.findByLabelText('Uppy Dashboard').trigger('paste', { clipboardData })
    })

    cy.wait('@uploadFile')
  })

  it('displays upload errors', function () {
    cy.intercept('post', '/project/*/upload?folder_id=root-folder-id', {
      statusCode: 422,
      body: { success: false, error: 'invalid_filename' },
    }).as('uploadFile')

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="upload" />
        </FileTreeProvider>
      </EditorProviders>
    )

    // the submit button should not be present
    cy.findByRole('button', { name: 'Create' }).should('not.exist')

    cy.wrap(null).then(() => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(
        new File(['test'], 'tes!t.tex', { type: 'text/plain' })
      )
      cy.findByLabelText('Uppy Dashboard').trigger('paste', { clipboardData })
    })

    cy.wait('@uploadFile')

    cy.findByText(
      `Upload failed: check that the file name doesn’t contain special characters, trailing/leading whitespace or more than 150 characters`
    )
  })
})

function OpenWithMode({ mode }: { mode: string }) {
  const { newFileCreateMode, startCreatingFile } = useFileTreeActionable()

  const { fileCount } = useFileTreeData()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startCreatingFile(mode), [])

  if (!fileCount || !newFileCreateMode) {
    return null
  }

  return <FileTreeModalCreateFile />
}
