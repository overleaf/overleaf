import FileTreeFolder from '../../../../../frontend/js/features/file-tree/components/file-tree-folder'
import { EditorProviders } from '../../../helpers/editor-providers'
import { FileTreeProvider } from '../helpers/file-tree-provider'
import { getContainerEl } from 'cypress/react18'
import ReactDom from 'react-dom'

describe('<FileTreeFolder/>', function () {
  it('renders unselected', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeFolder
            name="foo"
            id="123abc"
            folders={[]}
            docs={[]}
            files={[]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem', { selected: false })
    cy.findByRole('tree').should('not.exist')
  })

  it('renders selected', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '123abc' }],
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeFolder
            name="foo"
            id="123abc"
            folders={[]}
            docs={[]}
            files={[]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem', { selected: false }).click()
    cy.findByRole('treeitem', { selected: true })
    cy.findByRole('tree').should('not.exist')
  })

  it('expands', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '123abc' }],
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeFolder
            name="foo"
            id="123abc"
            folders={[]}
            docs={[]}
            files={[]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem')
    cy.findByRole('button', { name: 'Expand' }).click()
    cy.findByRole('tree')
  })

  it('saves the expanded state for the next render', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '123abc' }],
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeFolder
            name="foo"
            id="123abc"
            folders={[]}
            docs={[]}
            files={[]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('tree').should('not.exist')
    cy.findByRole('button', { name: 'Expand' }).click()
    cy.findByRole('tree')

    cy.then(() => ReactDom.unmountComponentAtNode(getContainerEl()))

    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeFolder
            name="foo"
            id="123abc"
            folders={[]}
            docs={[]}
            files={[]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('tree')
  })
})
