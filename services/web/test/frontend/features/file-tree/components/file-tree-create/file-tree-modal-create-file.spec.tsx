import { useEffect, useState } from 'react'
import FileTreeModalCreateFile from '../../../../../../frontend/js/features/file-tree/components/modals/file-tree-modal-create-file'
import { useFileTreeActionable } from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-actionable'
import { useFileTreeData } from '../../../../../../frontend/js/shared/context/file-tree-data-context'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { FileTreeProvider } from '../../helpers/file-tree-provider'
import getMeta from '@/utils/meta'
import CommandPaletteBody from '@/features/command-palette/components/command-palette-body'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'

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

    // Wait for auto-selection of name
    cy.findByLabelText('File Name').as('input')
    cy.get('@input').should($input => {
      const elem = $input[0] as HTMLInputElement
      expect(elem.selectionStart).to.equal(0)
      expect(elem.selectionEnd).to.equal('name.tex'.lastIndexOf('.'))
    })
    cy.get('@input').type('test')
    cy.findByRole('button', { name: 'Create' }).click()

    cy.wait('@createDoc')

    cy.get('@createDoc').its('request.body').should('deep.equal', {
      parent_folder_id: 'root-folder-id',
      name: 'test.tex',
    })
  })

  it('does not re-select the initial name when it is edited before the deferred selection runs', function () {
    cy.intercept('post', '/project/*/doc', {
      statusCode: 204,
    }).as('createDoc')

    // capture requestAnimationFrame callbacks so the test controls when the
    // deferred focus and selection of the initial name run
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = []
    const flushRequestAnimationFrameCallbacks = () => {
      requestAnimationFrameCallbacks
        .splice(0)
        .forEach(callback => callback(performance.now()))
    }
    cy.window().then(win => {
      cy.stub(win, 'requestAnimationFrame').callsFake(
        (callback: FrameRequestCallback) => {
          requestAnimationFrameCallbacks.push(callback)
          return requestAnimationFrameCallbacks.length
        }
      )
    })

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').as('input')
    // run the deferred focus, which schedules the selection of "name"
    cy.then(flushRequestAnimationFrameCallbacks)
    // edit the name before the deferred selection has run
    cy.get('@input').clear()
    cy.get('@input').type('test.tex')
    // run the deferred selection; it must not select the "test" part now that
    // the name has been edited
    cy.then(flushRequestAnimationFrameCallbacks)
    cy.get('@input').type('123')
    cy.get('@input').should('have.value', 'test.tex123')

    cy.findByRole('button', { name: 'Create' }).click()
    cy.wait('@createDoc')
    cy.get('@createDoc').its('request.body').should('deep.equal', {
      parent_folder_id: 'root-folder-id',
      name: 'test.tex123',
    })
  })

  it('does not select the initial name when it is edited before the deferred focus runs', function () {
    // capture requestAnimationFrame callbacks so the test controls when the
    // deferred focus and selection of the initial name run
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = []
    const flushRequestAnimationFrameCallbacks = () => {
      requestAnimationFrameCallbacks
        .splice(0)
        .forEach(callback => callback(performance.now()))
    }
    cy.window().then(win => {
      cy.stub(win, 'requestAnimationFrame').callsFake(
        (callback: FrameRequestCallback) => {
          requestAnimationFrameCallbacks.push(callback)
          return requestAnimationFrameCallbacks.length
        }
      )
    })

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').as('input')
    // edit the name before the deferred focus has run
    cy.get('@input').clear()
    cy.get('@input').type('test.tex')
    // run the deferred focus; it must not select the initial name now that
    // the name has been edited
    cy.then(flushRequestAnimationFrameCallbacks)
    cy.get('@input').type('123')
    cy.get('@input').should('have.value', 'test.tex123')
  })

  it('deletes the whole name when the deferred selection runs between select-all and delete', function () {
    // capture requestAnimationFrame callbacks so the test controls when the
    // deferred focus and selection of the initial name run
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = []
    const flushRequestAnimationFrameCallbacks = () => {
      requestAnimationFrameCallbacks
        .splice(0)
        .forEach(callback => callback(performance.now()))
    }
    cy.window().then(win => {
      cy.stub(win, 'requestAnimationFrame').callsFake(
        (callback: FrameRequestCallback) => {
          requestAnimationFrameCallbacks.push(callback)
          return requestAnimationFrameCallbacks.length
        }
      )
    })

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').as('input')
    // run the deferred focus and selection
    cy.then(flushRequestAnimationFrameCallbacks)
    // this mirrors cy.clear() -- focus, select-all and delete -- with a frame
    // boundary between the select-all and the delete: a deferred selection
    // scheduled on focus must not shrink the select-all to the name part, as
    // the delete would then leave the extension behind
    cy.get('@input').type('{selectall}')
    cy.then(flushRequestAnimationFrameCallbacks)
    cy.get('@input').type('{del}')
    cy.get('@input').should('have.value', '')
  })

  it('deletes the whole name when the deferred initial focus runs between select-all and delete', function () {
    // capture requestAnimationFrame callbacks so the test controls when the
    // deferred focus and selection of the initial name run
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = []
    const flushRequestAnimationFrameCallbacks = () => {
      requestAnimationFrameCallbacks
        .splice(0)
        .forEach(callback => callback(performance.now()))
    }
    cy.window().then(win => {
      cy.stub(win, 'requestAnimationFrame').callsFake(
        (callback: FrameRequestCallback) => {
          requestAnimationFrameCallbacks.push(callback)
          return requestAnimationFrameCallbacks.length
        }
      )
    })

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    // select-all before the deferred initial focus has run: it must not
    // shrink the select-all to the name part, as the delete would then leave
    // the extension behind
    cy.findByLabelText('File Name').as('input')
    cy.get('@input').type('{selectall}')
    cy.then(flushRequestAnimationFrameCallbacks)
    cy.get('@input').type('{del}')
    cy.get('@input').should('have.value', '')
  })

  it('re-focuses the input when focus is temporarily stolen from the modal', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenWithMode mode="doc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByLabelText('File Name').as('input')
    // Wait for auto-selection of name
    cy.get('@input').should($input => {
      const elem = $input[0] as HTMLInputElement
      expect(elem.selectionStart).to.equal(0)
      expect(elem.selectionEnd).to.equal('name.tex'.lastIndexOf('.'))
    })

    // Simulate focus moving outside the modal after it has opened, e.g. the
    // command palette returning focus to the editor after running the
    // "new file" command, or the editor stealing focus when the main doc
    // loads. The focus trap of the modal pulls the focus back into the modal.
    cy.window().then(win => {
      const outside = win.document.createElement('button')
      win.document.body.appendChild(outside)
      outside.focus()
      outside.remove()
    })

    // The input must be focused again with the name selected. Ideally only
    // the name part (without the extension) would be selected, but the focus
    // trap select()s the entire value when pulling the focus back into the
    // modal, and there is no upstream option to disable that. Accept both.
    cy.get('@input').should($input => {
      const elem = $input[0] as HTMLInputElement
      expect(elem.ownerDocument.activeElement, 'the input is focused').to.equal(
        elem
      )
      expect(elem.selectionStart).to.equal(0)
      expect(['name.tex'.lastIndexOf('.'), 'name.tex'.length]).to.include(
        elem.selectionEnd
      )
    })
  })

  it('focuses and selects the name when opened from the command palette', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <OpenFromCommandPalette />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('menuitem', { name: 'File: New file' }).click()

    // Ideally only the name part (without the extension) would be selected,
    // but the focus trap of the modal select()s the entire value when pulling
    // the focus back after the command palette returned it to the previously
    // focused element. Which of the two wins depends on timing; accept both.
    cy.findByLabelText('File Name').should($input => {
      const elem = $input[0] as HTMLInputElement
      expect(elem.ownerDocument.activeElement, 'the input is focused').to.equal(
        elem
      )
      expect(elem.selectionStart).to.equal(0)
      expect(['name.tex'.lastIndexOf('.'), 'name.tex'.length]).to.include(
        elem.selectionEnd
      )
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
            build: '1234-5678',
            path: 'baz.jpg',
          },
          {
            build: '1234-5678',
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
          build_id: '1234-5678',
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

  it('imports from a pasted URL and removes a trailing dot', function () {
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

    cy.wrap(null).then(() => {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', 'https://example.com/example.tex.')

      cy.findByLabelText('URL to fetch the file from').trigger('paste', {
        clipboardData,
      })
    })

    cy.findByLabelText('URL to fetch the file from').should(
      'have.value',
      'https://example.com/example.tex'
    )

    cy.findByLabelText('File Name In This Project').should(
      'have.value',
      'example.tex'
    )

    cy.findByLabelText('File Name In This Project').clear()
    cy.findByLabelText('File Name In This Project').type('test.tex')

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

  it('imports from a pasted URL without a trailing dot and keeps it unchanged', function () {
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

    cy.wrap(null).then(() => {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', 'https://example.com/example.tex')

      cy.findByLabelText('URL to fetch the file from').trigger('paste', {
        clipboardData,
      })
    })

    cy.findByLabelText('URL to fetch the file from').should(
      'have.value',
      'https://example.com/example.tex'
    )

    cy.findByLabelText('File Name In This Project').should(
      'have.value',
      'example.tex'
    )

    cy.findByLabelText('File Name In This Project').clear()
    cy.findByLabelText('File Name In This Project').type('test.tex')

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
    cy.findByRole('button', { name: 'Select files' }).should('be.focused')

    cy.wrap(null).then(() => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(
        new File(['test'], 'test.tex', { type: 'text/plain' })
      )
      cy.focused().trigger('paste', { clipboardData })
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

// Renders the real command palette next to the create-file modal, mirroring
// CommandPaletteRoot (the palette unmounts when hidden) and the "new_file"
// command registration from FileTreeActionButtons.
function OpenFromCommandPalette() {
  const { startCreatingFile } = useFileTreeActionable()
  const { fileCount } = useFileTreeData()
  const [showPalette, setShowPalette] = useState(true)

  useCommandProvider(
    () => [
      {
        id: 'new_file',
        label: 'New file',
        handler: () => startCreatingFile('doc'),
      },
    ],
    [startCreatingFile]
  )

  if (!fileCount) {
    return null
  }

  return (
    <>
      {showPalette && (
        <CommandPaletteBody
          show={showPalette}
          onHide={() => setShowPalette(false)}
        />
      )}
      <FileTreeModalCreateFile />
    </>
  )
}
