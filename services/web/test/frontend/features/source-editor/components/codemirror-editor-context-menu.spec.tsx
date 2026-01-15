import { mockScope } from '../helpers/mock-scope'
import {
  EditorProviders,
  makeEditorPropertiesProvider,
} from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'
import { FC } from 'react'
import { PermissionsContext } from '@/features/ide-react/context/permissions-context'
import { Permissions } from '@/features/ide-react/types/permissions'
import { DetachCompileContext } from '@/shared/context/detach-compile-context'
import { FileTreeDataContext } from '@/shared/context/file-tree-data-context'

const createPermissionsProvider = (
  permissions: Partial<Permissions>
): FC<React.PropsWithChildren> => {
  const defaultPermissions: Permissions = {
    read: true,
    comment: true,
    resolveOwnComments: false,
    resolveAllComments: false,
    trackedWrite: false,
    write: false,
    admin: false,
    labelVersion: false,
  }

  return function PermissionsProvider({ children }) {
    return (
      <PermissionsContext.Provider
        value={{ ...defaultPermissions, ...permissions }}
      >
        {children}
      </PermissionsContext.Provider>
    )
  }
}

const MockDetachCompileProvider: FC<React.PropsWithChildren> = ({
  children,
}) => (
  <DetachCompileContext.Provider
    value={
      {
        pdfUrl: '/pdf/output.pdf',
        pdfViewer: 'pdfjs',
        compiling: false,
      } as any
    }
  >
    {children}
  </DetachCompileContext.Provider>
)

const MockFileTreeDataProvider: FC<React.PropsWithChildren> = ({
  children,
}) => (
  <FileTreeDataContext.Provider
    value={
      {
        selectedEntities: [{ type: 'doc', id: '_root_doc_id' } as any],
      } as any
    }
  >
    {children}
  </FileTreeDataContext.Provider>
)

describe('editor context menu', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'editor-context-menu': 'enabled',
    })
    cy.interceptEvents()
    cy.interceptMetadata()
  })

  it('should open on right-click and close on Escape', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.editor-context-menu').should('not.exist')

    cy.get('.cm-line').eq(10).rightclick()
    cy.get('.editor-context-menu').should('be.visible')

    cy.get('body').type('{esc}')
    cy.get('.editor-context-menu').should('not.exist')
  })

  it('should close when clicking elsewhere', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(10).rightclick()
    cy.get('.editor-context-menu').should('be.visible')

    cy.get('.cm-line').eq(5).click()
    cy.get('.editor-context-menu').should('not.exist')
  })

  describe('when nothing is selected', function () {
    it('should enable Cut, Copy, Paste, Suggest edits and disable Delete, Comment', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /delete/i }).should('be.disabled')
        cy.findByRole('menuitem', { name: /comment/i }).should('be.disabled')
        cy.findByRole('menuitem', { name: /paste/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.enabled'
        )
      })
    })
  })

  describe('when text is selected', function () {
    it('should enable Cut, Copy, Paste, Delete, Suggest edits, and Comment', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(16).as('line')
      cy.get('@line').click()
      cy.get('@line').type('test text')
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      cy.get('.cm-selectionBackground').should('exist')

      cy.get('@line').rightclick()

      cy.get('.cm-selectionBackground').should('exist')
      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /paste/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /delete/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should('be.enabled')
      })
    })

    it('should copy selected text and close menu', function () {
      // Grant clipboard permissions for this test
      cy.wrap(
        Cypress.automation('remote:debugger:protocol', {
          command: 'Browser.grantPermissions',
          params: {
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
            origin: window.location.origin,
          },
        })
      )

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(16).as('line')
      cy.get('@line').click()
      cy.get('@line').type('test text')
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      cy.get('.cm-selectionBackground').should('exist')

      cy.get('@line').rightclick()

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /copy/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')
    })

    it('should cut and paste text via the context menu', function () {
      // Grant clipboard permissions for this test
      cy.wrap(
        Cypress.automation('remote:debugger:protocol', {
          command: 'Browser.grantPermissions',
          params: {
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
            origin: window.location.origin,
          },
        })
      )

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(16).as('line')
      cy.get('@line').click()
      cy.get('@line').type('hello world')

      // Select "world"
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      // Cut "world"
      cy.get('@line').rightclick()
      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')
      cy.get('@line').should('contain', 'hello ')
      cy.get('@line').should('not.contain', 'world')

      // Move cursor to beginning of line and right-click at column 0 so paste starts there
      cy.get('@line').type('{home}')
      cy.get('@line').rightclick(0, 0)

      // Paste "world" at the beginning
      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /paste/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')
      cy.get('@line').should('contain', 'worldhello')
    })

    it('should delete selected text', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(16).as('line')
      cy.get('@line').click()
      cy.get('@line').type('hello world')

      // Select "world"
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      cy.get('@line').rightclick()

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /delete/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')
      cy.get('@line').should('contain', 'hello ')
      cy.get('@line').should('not.contain', 'world')
    })
  })

  describe('track changes toggle', function () {
    let toggleTrackChangesListener: Cypress.Agent<sinon.SinonStub>

    beforeEach(function () {
      toggleTrackChangesListener = cy.stub().as('toggleTrackChanges')
      window.addEventListener(
        'toggle-track-changes',
        toggleTrackChangesListener
      )
    })

    afterEach(function () {
      window.removeEventListener(
        'toggle-track-changes',
        toggleTrackChangesListener
      )
    })

    it('should show "Suggest edits" in edit mode and dispatch toggle event when clicked', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{
              EditorPropertiesProvider: makeEditorPropertiesProvider({
                wantTrackChanges: false,
              }),
            }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.get('.editor-context-menu').within(() => {
        // Verify we're showing the edit mode label
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.visible'
        )
        cy.findByRole('menuitem', { name: /back to editing/i }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /suggest edits/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')

      // Verify the toggle event was dispatched
      cy.get('@toggleTrackChanges').should('have.been.calledOnce')
    })

    it('should show "Back to editing" in review mode and dispatch toggle event when clicked', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{
              EditorPropertiesProvider: makeEditorPropertiesProvider({
                wantTrackChanges: true,
              }),
            }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.get('.editor-context-menu').within(() => {
        // Verify we're showing the review mode label
        cy.findByRole('menuitem', { name: /back to editing/i }).should(
          'be.visible'
        )
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /back to editing/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')

      // Verify the toggle event was dispatched
      cy.get('@toggleTrackChanges').should('have.been.calledOnce')
    })
  })

  describe('when feature flag is disabled', function () {
    it('should not show the context menu', function () {
      window.metaAttributesCache.set('ol-splitTestVariants', {
        'editor-context-menu': 'default',
      })

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()
      cy.get('.editor-context-menu').should('not.exist')
    })
  })

  describe('when a user does not have edit permissions', function () {
    it('should only show Copy and Comment (hidden Cut, Paste, Delete, Suggest edits)', function () {
      const scope = mockScope()
      scope.permissions.write = false
      scope.permissions.trackedWrite = false

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{
              PermissionsProvider: createPermissionsProvider({
                write: false,
                trackedWrite: false,
                comment: true,
              }),
            }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      // Select some existing text
      cy.get('.cm-line').eq(10).as('line')
      cy.get('@line').click()
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      cy.get('.cm-selectionBackground').should('exist')

      cy.get('@line').rightclick()

      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('not.exist')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /paste/i }).should('not.exist')
        cy.findByRole('menuitem', { name: /delete/i }).should('not.exist')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should('be.enabled')
      })
    })
  })

  describe('when a user does not have comment permissions', function () {
    it('should hide the Comment button', function () {
      const scope = mockScope()
      scope.permissions.write = false
      scope.permissions.trackedWrite = false
      scope.permissions.comment = false

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{
              PermissionsProvider: createPermissionsProvider({
                write: false,
                trackedWrite: false,
                comment: false,
              }),
            }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      // Select some existing text
      cy.get('.cm-line').eq(10).as('line')
      cy.get('@line').click()
      cy.get('@line').type(
        '{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}{leftArrow}'
      )

      cy.get('.cm-selectionBackground').should('exist')

      cy.get('@line').rightclick()

      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /comment/i }).should('not.exist')
      })
    })
  })

  describe('pasting images via context menu', function () {
    it('should open figure modal on pasting image via context menu', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.fixture<Uint8Array<ArrayBuffer>>('images/gradient.png').then(
        gradientBuffer => {
          // Stub the clipboard API to return our test image
          cy.window().then(_win => {
            const readStub = cy.stub(navigator.clipboard, 'read')
            readStub.resolves([
              {
                types: ['image/png'],
                getType: cy
                  .stub()
                  .withArgs('image/png')
                  .resolves(new Blob([gradientBuffer], { type: 'image/png' })),
              },
            ])
          })

          // Right-click to open context menu
          cy.get('.cm-line').eq(10).rightclick()
          cy.get('.editor-context-menu').should('be.visible')

          // Click paste button
          cy.get('.editor-context-menu').within(() => {
            cy.findByRole('menuitem', { name: /paste/i }).click()
          })

          // Figure modal should open with the image
          cy.findByText('Upload from computer').should('be.visible')

          // Context menu should close
          cy.get('.editor-context-menu').should('not.exist')
        }
      )
    })
  })

  describe('sync to PDF button', function () {
    beforeEach(function () {
      // Stub the sync API call
      cy.intercept('GET', '/project/*/sync/code*', {
        statusCode: 200,
        body: { pdf: [] },
      }).as('syncToPdfRequest')
    })

    it('should show jump to location in PDF button and call sync API when clicked', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{
              DetachCompileProvider: MockDetachCompileProvider,
              FileTreeDataProvider: MockFileTreeDataProvider,
            }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /jump to location in pdf/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')

      // Verify the sync API was called and returned expected response
      cy.wait('@syncToPdfRequest').then(interception => {
        expect(interception.response?.statusCode).to.equal(200)
        expect(interception.response?.body).to.deep.equal({ pdf: [] })
      })
    })

    it('should hide button when visual preview is enabled', function () {
      window.metaAttributesCache.set('ol-splitTestVariants', {
        'editor-context-menu': 'enabled',
        'visual-preview': 'enabled',
      })

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /jump to location in pdf/i }).should(
          'not.exist'
        )
      })
    })
  })

  describe('gutter context menu', function () {
    const editorLine = 2
    const gutterLineIndex = editorLine + 1 // extra hidden gutter line

    it('should select entire line when right-clicking on gutter', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.editor-context-menu').should('not.exist')

      cy.get('.cm-line').eq(editorLine).as('targetLine')
      cy.get('@targetLine').click()
      cy.get('@targetLine').type('This is a test line')

      cy.get('@targetLine').click()
      cy.get('.cm-selectionBackground').should('not.exist')

      cy.get('.cm-gutterElement').eq(gutterLineIndex).rightclick()

      cy.get('.cm-selectionBackground').should('exist')
      cy.get('.editor-context-menu').should('be.visible')
    })

    it('should work with cut/copy/delete operations on gutter-selected line', function () {
      cy.wrap(
        Cypress.automation('remote:debugger:protocol', {
          command: 'Browser.grantPermissions',
          params: {
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
            origin: window.location.origin,
          },
        })
      )

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.window().then(win => {
        cy.stub(win.navigator.clipboard, 'writeText').as('writeText')
      })

      cy.get('.cm-line').eq(editorLine).as('testLine')
      cy.get('@testLine').click()
      cy.get('@testLine').type('Test line for gutter copy')

      cy.get('.cm-gutterElement').eq(gutterLineIndex).rightclick()

      cy.get('.cm-selectionBackground').should('exist')
      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.editor-context-menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /paste/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /delete/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should('be.enabled')

        cy.findByRole('menuitem', { name: /copy/i }).click()
      })

      cy.get('.editor-context-menu').should('not.exist')

      cy.get('@writeText').should('have.been.calledOnce')
      cy.get('@writeText').should(
        'have.been.calledWith',
        Cypress.sinon.match((text: string) =>
          text.includes('Test line for gutter copy')
        )
      )
    })

    it('should close menu when clicking elsewhere after gutter right-click', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-gutterElement').eq(5).rightclick()
      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.cm-line').eq(10).click()
      cy.get('.editor-context-menu').should('not.exist')
    })

    it('should close menu on Escape after gutter right-click', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-gutterElement').eq(5).rightclick()
      cy.get('.editor-context-menu').should('be.visible')

      cy.get('.cm-content').focus()
      cy.get('body').type('{esc}')
      cy.get('.editor-context-menu').should('not.exist')
    })

    it('should not show context menu on gutter when feature flag is disabled', function () {
      window.metaAttributesCache.set('ol-splitTestVariants', {
        'editor-context-menu': 'default',
      })

      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-gutterElement').eq(5).rightclick()
      cy.get('.editor-context-menu').should('not.exist')
    })
  })
})
