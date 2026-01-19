import { mockScope } from '../helpers/mock-scope'
import {
  EditorProviders,
  makeEditorPropertiesProvider,
  makeProjectProvider,
} from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'
import { FC } from 'react'
import { PermissionsContext } from '@/features/ide-react/context/permissions-context'
import { Permissions } from '@/features/ide-react/types/permissions'
import { DetachCompileContext } from '@/shared/context/detach-compile-context'
import { FileTreeDataContext } from '@/shared/context/file-tree-data-context'
import PackageVersions from '../../../../../app/src/infrastructure/PackageVersions'
import { mockProject } from '../helpers/mock-project'

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

// Regex to match plain "Paste" but exclude "Paste with formatting" and "Paste without formatting"
const pasteLabelMatcher = /^paste(?! with| without)/i

const grantClipboardPermissions = () => {
  cy.wrap(
    Cypress.automation('remote:debugger:protocol', {
      command: 'Browser.grantPermissions',
      params: {
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        origin: window.location.origin,
      },
    })
  )
}

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

    cy.findByRole('menu').should('not.exist')

    cy.get('.cm-line').eq(10).rightclick()
    cy.findByRole('menu').should('be.visible')

    cy.get('body').type('{esc}')
    cy.findByRole('menu').should('not.exist')
  })

  it('should open on Shift+F10', { retries: 1 }, function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(8).click()
    cy.findByRole('menu').should('not.exist')

    cy.get('.cm-line').eq(8).trigger('keydown', {
      key: 'F10',
      code: 'F10',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      force: true,
    })

    cy.findByRole('menu').should('be.visible')
  })

  it('should close when clicking elsewhere in the editor', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(10).rightclick()
    cy.findByRole('menu').should('be.visible')

    cy.get('.cm-line').eq(5).click()
    cy.findByRole('menu').should('not.exist')
  })

  it('should should close when clicking outside the editor', function () {
    const scope = mockScope()
    const outsideEditorButtonName = 'Recompile'
    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <button>{outsideEditorButtonName}</button>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Open context menu
    cy.get('.cm-line').eq(10).rightclick()
    cy.findByRole('menu').should('be.visible')

    cy.findByRole('button', { name: outsideEditorButtonName }).click()
    cy.findByRole('menu').should('not.exist')
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

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: pasteLabelMatcher }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', {
          name: /paste with formatting/i,
        }).should('be.enabled')
        cy.findByRole('menuitem', { name: /delete/i }).should(
          'have.attr',
          'aria-disabled',
          'true'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should(
          'have.attr',
          'aria-disabled',
          'true'
        )
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
      cy.findByRole('menu').should('be.visible')

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: pasteLabelMatcher }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', {
          name: /paste with formatting/i,
        }).should('be.enabled')
        cy.findByRole('menuitem', { name: /delete/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should('be.enabled')
      })
    })

    it('should copy selected text and close menu', function () {
      grantClipboardPermissions()

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

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /copy/i }).click()
      })

      cy.findByRole('menu').should('not.exist')
    })

    it('should cut and paste text', function () {
      grantClipboardPermissions()

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
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).click()
      })

      cy.findByRole('menu').should('not.exist')
      cy.get('@line').should('contain', 'hello ')
      cy.get('@line').should('not.contain', 'world')

      // Move cursor to beginning of line and right-click at column 0 so paste starts there
      cy.get('@line').type('{home}')
      cy.get('@line').rightclick(0, 0)

      // Paste "world" at the beginning
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: pasteLabelMatcher }).click()
      })

      cy.findByRole('menu').should('not.exist')
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

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /delete/i }).click()
      })

      cy.findByRole('menu').should('not.exist')
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
            projectFeatures={{ trackChanges: true }}
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

      cy.findByRole('menu').within(() => {
        // Verify we're showing the edit mode label
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.visible'
        )
        cy.findByRole('menuitem', { name: /back to editing/i }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /suggest edits/i }).click()
      })

      cy.findByRole('menu').should('not.exist')

      // Verify the toggle event was dispatched
      cy.get('@toggleTrackChanges').should('have.been.calledOnce')
    })

    it('should show "Back to editing" in review mode and dispatch toggle event when clicked', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            projectFeatures={{ trackChanges: true }}
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

      cy.findByRole('menu').within(() => {
        // Verify we're showing the review mode label
        cy.findByRole('menuitem', { name: /back to editing/i }).should(
          'be.visible'
        )
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /back to editing/i }).click()
      })

      cy.findByRole('menu').should('not.exist')

      // Verify the toggle event was dispatched
      cy.get('@toggleTrackChanges').should('have.been.calledOnce')
    })

    it('should disable suggest edits when project does not support track changes', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            projectFeatures={{ trackChanges: false }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(10).rightclick()

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'have.attr',
          'aria-disabled',
          'true'
        )
      })
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
      cy.findByRole('menu').should('not.exist')
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

      cy.findByRole('menu').should('be.visible')

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('not.exist')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: pasteLabelMatcher }).should(
          'not.exist'
        )
        cy.findByRole('menuitem', { name: /paste with formatting/ }).should(
          'not.exist'
        )
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

      cy.findByRole('menu').should('be.visible')

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /comment/i }).should('not.exist')
      })
    })
  })

  describe('when pasting an image', function () {
    it('should open figure modal on pasting image', function () {
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
          cy.findByRole('menu').should('be.visible')

          // Click paste button
          cy.findByRole('menu').within(() => {
            cy.findByRole('menuitem', { name: pasteLabelMatcher }).click()
          })

          // Figure modal should open with the image
          cy.findByText('Upload from computer').should('be.visible')

          // Context menu should close
          cy.findByRole('menu').should('not.exist')
        }
      )
    })
  })

  describe('when a user has HTML content in the clipboard', function () {
    const formattedHtml =
      '<b>foo</b><sup>th</sup> <i>bar</i><sub>2</sub> baz <em>woo</em> <strong>woo</strong> woo'
    const plainText = 'footh bar2 baz woo woo woo'

    beforeEach(function () {
      grantClipboardPermissions()

      // Stub the clipboard API with formatted HTML
      cy.window().then(win => {
        const getTypeStub = cy.stub()
        getTypeStub
          .withArgs('text/html')
          .resolves(new Blob([formattedHtml], { type: 'text/html' }))
        getTypeStub
          .withArgs('text/plain')
          .resolves(new Blob([plainText], { type: 'text/plain' }))

        cy.stub(win.navigator.clipboard, 'read').resolves([
          {
            types: ['text/html', 'text/plain'],
            getType: getTypeStub,
          },
        ])
        cy.stub(win.navigator.clipboard, 'readText').resolves(plainText)
      })
    })

    describe('when pasting with formatting', function () {
      it('should paste formatted HTML with LaTeX commands', function () {
        const scope = mockScope()

        cy.mount(
          <TestContainer>
            <EditorProviders scope={scope}>
              <CodeMirrorEditor />
            </EditorProviders>
          </TestContainer>
        )

        cy.get('.cm-line').eq(10).rightclick()
        cy.findByRole('menu').within(() => {
          cy.findByRole('menuitem', {
            name: /paste with formatting/i,
          }).click()
        })

        cy.findByRole('menu').should('not.exist')

        cy.get('.cm-line').should($lines => {
          const text = $lines.text()
          expect(text).to.include(
            '\\textbf{foo}\\textsuperscript{th} \\textit{bar}\\textsubscript{2} baz \\textit{woo} \\textbf{woo} woo'
          )
        })
      })
    })

    describe('when pasting without formatting', function () {
      it('should paste plain text without LaTeX commands', function () {
        const scope = mockScope()

        cy.mount(
          <TestContainer>
            <EditorProviders scope={scope}>
              <CodeMirrorEditor />
            </EditorProviders>
          </TestContainer>
        )

        cy.get('.cm-line').eq(10).rightclick()
        cy.findByRole('menu').within(() => {
          cy.findByRole('menuitem', { name: pasteLabelMatcher }).click()
        })

        cy.findByRole('menu').should('not.exist')

        cy.get('.cm-line').should($lines => {
          const text = $lines.text()
          expect(text).to.include('footh bar2 baz woo woo woo')
          expect(text).to.not.include('\\textbf{foo}')
          expect(text).to.not.include('\\textsuperscript{th}')
          expect(text).to.not.include('\\textit{bar}')
          expect(text).to.not.include('\\textsubscript{2}')
        })
      })
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

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /jump to location in pdf/i }).click()
      })

      cy.findByRole('menu').should('not.exist')

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

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /jump to location in pdf/i }).should(
          'not.exist'
        )
      })
    })
  })

  describe('when interacting with other tooltips/menus', function () {
    it('should hide the add-comment tooltip when the context menu opens', function () {
      const scope = mockScope(undefined, {
        docOptions: { wantTrackChanges: true },
      })

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            projectFeatures={{ trackChangesVisible: true }}
            features={{ trackChangesVisible: true }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(12).type('{shift}{leftArrow}', {
        scrollBehavior: false,
      })

      cy.get('.review-tooltip-menu').should('exist')

      cy.get('.cm-line').eq(5).rightclick()
      cy.findByRole('menu').should('be.visible')
      cy.get('.review-tooltip-menu').should('not.exist')
    })

    it('should close the spelling suggestions menu when another context menu opens', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-learnedWords', ['baz'])
        win.metaAttributesCache.set(
          'ol-dictionariesRoot',
          `js/dictionaries/${PackageVersions.version.dictionaries}/`
        )
        win.metaAttributesCache.set('ol-baseAssetPath', '/__cypress/src/')
        win.metaAttributesCache.set('ol-languages', [
          { code: 'en_GB', dic: 'en_GB', name: 'English (British)' },
        ])
      })

      const spellcheckerContent = `
      \\documentclass{}

      \\title{}
      \\author{}

      \\begin{document}
      \\maketitle

      \\begin{abstract}
      \\end{abstract}

      \\section{}

      \\end{document}`

      const scope = mockScope(spellcheckerContent)
      const project = mockProject({ spellCheckLanguage: 'en_GB' })

      cy.mount(
        <TestContainer>
          <EditorProviders
            scope={scope}
            providers={{ ProjectProvider: makeProjectProvider(project) }}
          >
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(13).as('line')
      cy.get('@line').click()
      cy.get('@line').type('medecin foo', { delay: 0 })

      cy.get('@line')
        .find('.ol-cm-spelling-error', { timeout: 15000 })
        .should('have.length', 1)

      cy.get('@line').find('.ol-cm-spelling-error').rightclick()
      cy.get('.ol-cm-spelling-context-menu-tooltip').should('be.visible')

      cy.get('.cm-line').eq(5).rightclick()
      cy.findByRole('menu').should('be.visible')
      cy.get('.ol-cm-spelling-context-menu-tooltip').should('not.exist')
    })

    it('should close math preview tooltip when context menu opens', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      // Click on a math expression to show the tooltip
      cy.get('.cm-line').eq(5).click()
      cy.get('.cm-line')
        .eq(5)
        .type('$x + y$', { parseSpecialCharSequences: false })
      // Move cursor into the math expression
      cy.get('.cm-line').eq(5).type('{leftArrow}{leftArrow}')

      cy.get('.ol-cm-math-tooltip').should('be.visible')

      cy.get('.cm-line').eq(5).rightclick()

      cy.get('.ol-cm-math-tooltip').should('not.exist')
      cy.findByRole('menu').should('be.visible')
    })
  })

  describe('when right-clicking on the gutter', function () {
    const editorLine = 2
    const gutterLineIndex = editorLine + 1 // extra hidden gutter line

    it('should select entire line', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.findByRole('menu').should('not.exist')

      cy.get('.cm-line').eq(editorLine).as('targetLine')
      cy.get('@targetLine').click()
      cy.get('@targetLine').type('This is a test line')

      cy.get('@targetLine').click()
      cy.get('.cm-selectionBackground').should('not.exist')

      cy.get('.cm-gutterElement').eq(gutterLineIndex).rightclick()

      cy.get('.cm-selectionBackground').should('exist')
      cy.findByRole('menu').should('be.visible')
    })

    it('should work with cut/copy/delete operations on gutter-selected line', function () {
      grantClipboardPermissions()

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
      cy.findByRole('menu').should('be.visible')

      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /cut/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /copy/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: pasteLabelMatcher }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', { name: /delete/i }).should('be.enabled')
        cy.findByRole('menuitem', { name: /suggest edits/i }).should(
          'be.enabled'
        )
        cy.findByRole('menuitem', { name: /comment/i }).should('be.enabled')

        cy.findByRole('menuitem', { name: /copy/i }).click()
      })

      cy.findByRole('menu').should('not.exist')

      cy.get('@writeText').should('have.been.calledOnce')
      cy.get('@writeText').should(
        'have.been.calledWith',
        Cypress.sinon.match((text: string) =>
          text.includes('Test line for gutter copy')
        )
      )
    })

    it('should close menu when clicking elsewhere', function () {
      const scope = mockScope()

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-gutterElement').eq(5).rightclick()
      cy.findByRole('menu').should('be.visible')

      cy.get('.cm-line').eq(10).click()
      cy.findByRole('menu').should('not.exist')
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
      cy.findByRole('menu').should('be.visible')

      cy.get('.cm-content').focus()
      cy.get('body').type('{esc}')
      cy.findByRole('menu').should('not.exist')
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
      cy.findByRole('menu').should('not.exist')
    })
  })
})
