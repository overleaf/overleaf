import React, { FC, useEffect, useRef, useState } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import { TabsContainer } from '../../../../../frontend/js/features/source-editor/components/tabs/tabs-container'
import {
  FileTreeDocumentFindResult,
  FileTreeFileRefFindResult,
} from '@/features/ide-react/types/file-tree'
import {
  EditorManager,
  EditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'
import { TAB_TRANSFER_TYPE } from '@/features/ide-react/context/tabs-context'
import {
  EditorViewContext,
  useEditorViewContext,
} from '@/features/ide-react/context/editor-view-context'
import { EditorView } from '@codemirror/view'
import { EditorState, Transaction } from '@codemirror/state'
import { tabsListener } from '@/features/source-editor/extensions/tabs-listener'
import ReviewPanelTabsHeaderPortal from '@/features/review-panel/components/review-panel-tabs-header-portal'
import { FileTree } from '@/features/ide-react/components/file-tree'
import { PROJECT_ID } from '../../../helpers/editor-providers'

const DOC_IDS = {
  main: 'doc-main-id',
  intro: 'doc-intro-id',
  appendix: 'doc-appendix-id',
  bibFile: 'file-bib-id',
  introA: 'doc-main-a',
  introB: 'doc-main-b',
}

const FOLDER_IDS = {
  chapterA: 'folder-chapter-a',
  chapterB: 'folder-chapter-b',
}

const DOC_NAMES: Record<string, string> = {
  [DOC_IDS.main]: 'main.tex',
  [DOC_IDS.intro]: 'intro.tex',
  [DOC_IDS.appendix]: 'appendix.tex',
  [DOC_IDS.bibFile]: 'refs.bib',
  [DOC_IDS.introA]: 'intro.tex',
  [DOC_IDS.introB]: 'intro.tex',
}

function makeRootFolder(
  docs: { _id: string; name: string }[] = [],
  folders: any[] = [],
  fileRefs: { _id: string; name: string }[] = []
) {
  return [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs,
      folders,
      fileRefs,
    },
  ]
}

const defaultDocs = [
  { _id: DOC_IDS.main, name: 'main.tex' },
  { _id: DOC_IDS.intro, name: 'intro.tex' },
  { _id: DOC_IDS.appendix, name: 'appendix.tex' },
]

const defaultRootFolder = makeRootFolder(defaultDocs)

function makeDocEntity(
  id: string,
  name: string,
  path: string[] = ['root-folder-id']
): FileTreeDocumentFindResult {
  return {
    type: 'doc',
    entity: { _id: id, name },
    parent: [],
    parentFolderId: path[path.length - 1],
    path,
    index: 0,
  }
}

function makeFileRefEntity(
  id: string,
  name: string
): FileTreeFileRefFindResult {
  return {
    type: 'fileRef',
    entity: {
      _id: id,
      name,
      linkedFileData: undefined,
      created: new Date().toISOString(),
      hash: 'abc123',
    },
    parent: [],
    parentFolderId: 'root-folder-id',
    path: ['root-folder-id'],
    index: 0,
  }
}

function makeEditorManagerProvider() {
  const EditorManagerProvider: FC<React.PropsWithChildren> = ({ children }) => {
    const value = {
      getEditorType: () => null,
      getCurrentDocValue: () => null,
      getCurrentDocumentId: () => null,
      setIgnoringExternalUpdates: () => {},
      openDocWithId: cy.stub().as('openDocWithId').resolves(),
      openDoc: cy.stub().as('openDoc').resolves(),
      openDocs: { awaitBufferedOps: cy.stub().resolves() } as any,
      openFileWithId: cy.stub().as('openFileWithId'),
      openInitialDoc: cy.stub().resolves(),
      isLoading: false,
      jumpToLine: () => {},
      debugTimers: { current: {} },
    } as unknown as EditorManager

    return (
      <EditorManagerContext.Provider value={value}>
        {children}
      </EditorManagerContext.Provider>
    )
  }
  return EditorManagerProvider
}

function makeEditorViewProvider() {
  const EditorViewProvider: FC<React.PropsWithChildren> = ({ children }) => {
    const parentRef = useRef<HTMLDivElement>(null)
    const [view, setView] = useState<EditorView | null>(null)
    useEffect(() => {
      if (!parentRef.current) return
      const editorView = new EditorView({
        state: EditorState.create({
          extensions: [
            tabsListener(true),
            EditorView.contentAttributes.of({
              'data-testid': 'mock-editor-view',
            }),
          ],
        }),
        parent: parentRef.current,
      })
      setView(editorView)
      return () => editorView.destroy()
    }, [])
    return (
      <EditorViewContext.Provider value={{ view, setView: () => {} }}>
        {children}
        <div ref={parentRef} />
      </EditorViewContext.Provider>
    )
  }
  return EditorViewProvider
}

function RemoteChangeButton() {
  const { view } = useEditorViewContext()
  return (
    <button
      type="button"
      onClick={() =>
        view?.dispatch({
          changes: { from: 0, insert: 'remote text' },
          annotations: Transaction.remote.of(true),
        })
      }
    >
      Add a remote change
    </button>
  )
}

function expandFolders(path: string[] = []) {
  // path[0] is the root folder, so skip that one
  path.slice(1).forEach(folderId => {
    cy.get(`[data-file-id="${folderId}"] .file-tree-entity-button`).click()
  })
}

// Target rows by entity id rather than accessible name so that entities sharing
// a name stay unambiguous.
function selectEntity(
  entity: FileTreeDocumentFindResult | FileTreeFileRefFindResult
) {
  expandFolders(entity.path)
  cy.get(`[data-file-id="${entity.entity._id}"]`).click()
  cy.get(`[data-tab-id="${entity.entity._id}"]`).should('exist')
}

function selectDoc(id: string, path?: string[]) {
  selectEntity(makeDocEntity(id, DOC_NAMES[id], path))
}

function enableEditorTabs() {
  cy.window().then(win => {
    win.metaAttributesCache.set('ol-splitTestVariants', {
      'editor-tabs': 'enabled',
    })
    win.metaAttributesCache.set('ol-labsExperiments', ['editor-tabs'])
  })
}

describe('File Tabs', function () {
  function mountTabs(options?: { rootFolder?: any; userSettings?: any }) {
    const rootFolder = options?.rootFolder ?? defaultRootFolder
    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        rootDocId={DOC_IDS.main}
        userSettings={options?.userSettings}
        providers={{
          EditorManagerProvider: makeEditorManagerProvider(),
          EditorViewProvider: makeEditorViewProvider(),
        }}
      >
        <TabsContainer />
        <FileTree />
        <ReviewPanelTabsHeaderPortal />
        <RemoteChangeButton />
      </EditorProviders>
    )
  }

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptTutorials()
    cy.interceptCompile()
    enableEditorTabs()

    // Clear persisted tab state from localStorage
    cy.window().then(win => {
      Object.keys(win.localStorage).forEach(key => {
        if (key.startsWith('open-tabs:') || key.startsWith('folder.')) {
          win.localStorage.removeItem(key)
        }
      })

      // Pointing doc.open_id at a non-existent entity stops the file tree
      // auto-selecting
      win.localStorage.setItem(
        `doc.open_id.${PROJECT_ID}`,
        JSON.stringify('no-open-doc')
      )
    })
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })

    mountTabs()

    cy.findByTestId('mock-editor-view').as('editorView')
  })

  describe('Initial file selection', function () {
    it('automatically creates a tab for the initially opened file', function () {
      cy.window().then(win => {
        win.localStorage.setItem(
          `doc.open_id.${PROJECT_ID}`,
          JSON.stringify(DOC_IDS.intro)
        )
      })
      mountTabs()

      cy.findByRole('tab', { name: /intro\.tex/ }).should('exist')
    })
  })

  describe('Tab display', function () {
    it('displays a tab when a file is selected', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
    })

    it('marks the selected tab as active', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ })
        .should('have.attr', 'aria-selected', 'true')
        .and('have.class', 'tab-selected')
    })
  })

  describe('Opening tabs on file change', function () {
    it('opens a new tab when a different file is selected', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')

      // Make main permanent (keypress) so selecting another file doesn't replace it
      cy.get('@editorView').type('a')

      // Select another file
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /intro\.tex/ }).should('exist')
    })

    it('does not duplicate a tab when the same file is selected again', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findAllByRole('tab').should('have.length', 1)

      // Select the same file again
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findAllByRole('tab').should('have.length', 1)
    })
  })

  describe('Temporary tabs', function () {
    beforeEach(function () {
      mountTabs({ userSettings: { previewTabs: true } })
    })

    it('opens a newly selected file as a temporary tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      // The first tab is temporary until a keypress
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )
    })

    it('makes a temporary tab permanent when a key is pressed', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )

      cy.get('@editorView').type('a')

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'not.have.class',
        'tab-temporary'
      )
    })

    it('replaces a temporary tab when selecting yet another file', function () {
      // Open main (temporary)
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')

      // Make main permanent
      cy.get('@editorView').type('a')

      // Open intro (temporary)
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.findByRole('tab', { name: /intro\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )

      // Open appendix — should replace temporary intro
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findByRole('tab', { name: /intro\.tex/ }).should('not.exist')
      cy.findByRole('tab', { name: /appendix\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
    })

    it('does not make a temporary tab permanent on remote changes', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )

      cy.findByRole('button', { name: 'Add a remote change' }).click()

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )
    })

    it('makes a temporary tab permanent on double-click', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )

      cy.findByRole('tab', { name: /main\.tex/ }).dblclick()

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'not.have.class',
        'tab-temporary'
      )
    })

    it('makes a temporary tab permanent on double-clicking its file tree entry', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-temporary'
      )

      cy.findByRole('treeitem', { name: 'main.tex' }).dblclick()

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'not.have.class',
        'tab-temporary'
      )
    })

    it('opens a new tab as permanent when previewTabs is disabled', function () {
      mountTabs({ userSettings: { previewTabs: false } })

      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'not.have.class',
        'tab-temporary'
      )
    })
  })

  describe('Closing tabs', function () {
    it('closes a tab via the close button', function () {
      // Open main
      cy.then(() => selectDoc(DOC_IDS.main))
      // Open intro
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findAllByRole('tab').should('have.length', 2)

      // Close intro
      cy.findByRole('tab', { name: /intro\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close' }).click()
      })

      cy.findByRole('tab', { name: /intro\.tex/ }).should('not.exist')
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
    })

    it('cannot close the last remaining tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findAllByRole('tab').should('have.length', 1)

      cy.findByRole('tab', { name: /main\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close' }).should('be.disabled')
      })
    })

    it('switches to an adjacent tab when closing the currently active tab', function () {
      // Open three tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      // Close the currently selected tab (appendix — the last one selected)
      cy.findByRole('tab', { name: /appendix\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close' }).click()
      })

      cy.findByRole('tab', { name: /appendix\.tex/ }).should('not.exist')

      // The context should have tried to open an adjacent tab
      cy.get('@openDocWithId').should('have.been.calledWith', DOC_IDS.intro)
    })

    it('closes a tab on middle-click', function () {
      // Open two tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findAllByRole('tab').should('have.length', 2)

      // Middle-click intro tab
      cy.findByRole('tab', { name: /intro\.tex/ }).trigger('mouseup', {
        button: 1,
      })

      cy.findByRole('tab', { name: /intro\.tex/ }).should('not.exist')
    })
  })

  describe('Context menu', function () {
    it('opens the context menu on right-click of a tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()

      cy.findByRole('menu').should('exist')
      cy.findByRole('menuitem', { name: 'Close' }).should('exist')
      cy.findByRole('menuitem', { name: 'Close other tabs' }).should('exist')
      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).should(
        'exist'
      )
      cy.findByRole('menuitem', { name: 'Tab settings…' }).should('exist')
    })

    it('closes the clicked tab via "Close"', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close' }).click()

      cy.findByRole('tab', { name: /intro\.tex/ }).should('not.exist')
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
      cy.findByRole('menu').should('not.exist')
    })

    it('closes all other tabs via "Close other tabs"', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close other tabs' }).click()

      cy.findAllByRole('tab').should('have.length', 1)
      cy.findByRole('tab', { name: /intro\.tex/ }).should('exist')
    })

    it('navigates to the target tab when closing others from a non-active tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      // appendix is the currently active tab; close others from intro
      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close other tabs' }).click()

      cy.get('@openDocWithId').should('have.been.calledWith', DOC_IDS.intro)
    })

    it('closes tabs to the right of the target via "Close tabs to the right"', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).click()

      cy.findAllByRole('tab').should('have.length', 2)
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /intro\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /appendix\.tex/ }).should('not.exist')
    })

    it('navigates to the target tab when the active tab is closed to the right', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      // appendix is the active tab; closing to the right of intro removes it
      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).click()

      cy.get('@openDocWithId').should('have.been.calledWith', DOC_IDS.intro)
    })

    it('keeps the active tab selected when it is to the left of the target', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      // Re-select main so it becomes the active tab again (still at index 0)
      cy.then(() => selectDoc(DOC_IDS.main))

      // Closing to the right of intro removes appendix but not the active tab
      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).click()

      cy.findAllByRole('tab').should('have.length', 2)
      cy.findByRole('tab', { name: /appendix\.tex/ }).should('not.exist')
      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.attr',
        'aria-selected',
        'true'
      )
    })

    it('disables the close actions when only one tab is open', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ }).rightclick()

      cy.findByRole('menuitem', { name: 'Close' }).should(
        'have.attr',
        'aria-disabled',
        'true'
      )
      cy.findByRole('menuitem', { name: 'Close other tabs' }).should(
        'have.attr',
        'aria-disabled',
        'true'
      )
      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).should(
        'have.attr',
        'aria-disabled',
        'true'
      )
    })

    it('disables "Close tabs to the right" when the target is the last tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      // appendix is the rightmost tab, so there is nothing to close to its right
      cy.findByRole('tab', { name: /appendix\.tex/ }).rightclick()

      cy.findByRole('menuitem', { name: 'Close tabs to the right' }).should(
        'have.attr',
        'aria-disabled',
        'true'
      )
      // The other actions remain enabled with more than one tab open
      cy.findByRole('menuitem', { name: 'Close' }).should(
        'not.have.attr',
        'aria-disabled',
        'true'
      )
      cy.findByRole('menuitem', { name: 'Close other tabs' }).should(
        'not.have.attr',
        'aria-disabled',
        'true'
      )
    })

    it('opens tab settings via "Tab settings…"', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.window().then(win => {
        cy.spy(win, 'dispatchEvent').as('dispatchEvent')
      })

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menuitem', { name: 'Tab settings…' }).click()

      // opens the settings modal...
      cy.get('@dispatchEvent').should(
        'have.been.calledWithMatch',
        Cypress.sinon.match({ type: 'ui.toggle-settings', detail: true })
      )
      // ...and focuses the editorTabs setting
      cy.get('@dispatchEvent').should(
        'have.been.calledWithMatch',
        Cypress.sinon.match({ type: 'ui.focus-setting', detail: 'editorTabs' })
      )

      // and the context menu closes
      cy.findByRole('menu').should('not.exist')
    })

    it('closes the menu on Escape', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menu').should('exist')

      cy.findByRole('menu').trigger('keydown', {
        key: 'Escape',
      })

      cy.findByRole('menu').should('not.exist')
    })

    it('closes the menu on right-click outside', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menu').should('exist')

      // Right-click outside any tab
      cy.get('.editor-tabs-container').rightclick('right')

      cy.findByRole('menu').should('not.exist')
    })

    it('focuses the menu when opening', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()

      cy.findByRole('menu').should('be.focused')
    })

    it('returns focus to the originating tab when closing', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menu').trigger('keydown', { key: 'Escape' })

      cy.findByRole('tab', { name: /intro\.tex/ }).should('be.focused')
    })

    it('moves the menu to another tab on right-click', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menu').should('exist')

      // Right-click appendix the menu should retarget to that tab
      cy.findByRole('tab', { name: /appendix\.tex/ }).rightclick({
        force: true,
      })
      cy.findByRole('menuitem', { name: 'Close other tabs' }).click()

      cy.findAllByRole('tab').should('have.length', 1)
      cy.findByRole('tab', { name: /appendix\.tex/ }).should('exist')
    })

    it('should not open the context menu if shift is held', function () {
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick({
        shiftKey: true,
      })
      cy.findByRole('menu').should('not.exist')
    })

    it('should close already open context menu if shift is held', function () {
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findByRole('tab', { name: /intro\.tex/ }).rightclick()
      cy.findByRole('menu').should('exist')
      cy.findByRole('tab', { name: /main\.tex/ }).rightclick({
        force: true,
        shiftKey: true,
      })
      cy.findByRole('menu').should('not.exist')
    })
  })

  describe('Tab interaction', function () {
    it('calls openDocWithId when clicking a non-selected doc tab', function () {
      // Open two tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      // Click main tab
      cy.findByRole('tab', { name: /main\.tex/ }).click()

      cy.get('@openDocWithId').should('have.been.calledWith', DOC_IDS.main)
    })

    it('calls openFileWithId when clicking a non-selected fileRef tab', function () {
      const rootFolder = makeRootFolder(
        [{ _id: DOC_IDS.main, name: 'main.tex' }],
        [],
        [{ _id: DOC_IDS.bibFile, name: 'refs.bib' }]
      )

      mountTabs({ rootFolder })

      // Open main doc
      cy.then(() => selectDoc(DOC_IDS.main))

      // Open fileRef
      cy.then(() =>
        selectEntity(makeFileRefEntity(DOC_IDS.bibFile, 'refs.bib'))
      )

      // Switch back to main so refs.bib is no longer selected
      cy.findByRole('tab', { name: /main\.tex/ }).click()

      // Click the fileRef tab
      cy.findByRole('tab', { name: /refs\.bib/ }).click()

      cy.get('@openFileWithId').should('have.been.calledWith', DOC_IDS.bibFile)
    })
  })

  describe('Drag and drop', function () {
    it('reorders tabs by dragging to the right of another tab', function () {
      // Open three tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      // Verify initial order
      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'intro.tex')
      cy.findAllByRole('tab').eq(2).should('contain.text', 'appendix.tex')

      // Drag main to the right of appendix
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(TAB_TRANSFER_TYPE, DOC_IDS.main)

      cy.findByRole('tab', { name: /main\.tex/ }).trigger('dragstart', {
        dataTransfer,
      })

      cy.findByRole('tab', { name: /appendix\.tex/ }).then($el => {
        const rect = $el[0].getBoundingClientRect()
        cy.wrap($el).trigger('dragover', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.75,
        })
        cy.wrap($el).trigger('drop', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.75,
        })
      })

      // Expected order after move: intro, appendix, main
      cy.findAllByRole('tab').eq(0).should('contain.text', 'intro.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'appendix.tex')
      cy.findAllByRole('tab').eq(2).should('contain.text', 'main.tex')
    })

    it('reorders tabs by dragging to the left of another tab', function () {
      // Open three tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      // Verify initial order
      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'intro.tex')
      cy.findAllByRole('tab').eq(2).should('contain.text', 'appendix.tex')

      // Drag appendix to the left of main
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(TAB_TRANSFER_TYPE, DOC_IDS.appendix)

      cy.findByRole('tab', { name: /appendix\.tex/ }).trigger('dragstart', {
        dataTransfer,
      })

      cy.findByRole('tab', { name: /main\.tex/ }).then($el => {
        const rect = $el[0].getBoundingClientRect()
        cy.wrap($el).trigger('dragover', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.25,
        })
        cy.wrap($el).trigger('drop', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.25,
        })
      })

      // Expected order: appendix, main, intro
      cy.findAllByRole('tab').eq(0).should('contain.text', 'appendix.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'main.tex')
      cy.findAllByRole('tab').eq(2).should('contain.text', 'intro.tex')
    })

    it('shows a drop indicator when dragging over a tab', function () {
      // Open two tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      const dataTransfer = new DataTransfer()
      dataTransfer.setData(TAB_TRANSFER_TYPE, DOC_IDS.intro)

      cy.findByRole('tab', { name: /intro\.tex/ }).trigger('dragstart', {
        dataTransfer,
      })

      // Drag over left side of main tab
      cy.findByRole('tab', { name: /main\.tex/ }).then($el => {
        const rect = $el[0].getBoundingClientRect()
        cy.wrap($el).trigger('dragover', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.25,
        })
      })

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'have.class',
        'tab-drop-left'
      )

      // Drag leave should clear the indicator
      cy.findByRole('tab', { name: /main\.tex/ }).trigger('dragleave')

      cy.findByRole('tab', { name: /main\.tex/ }).should(
        'not.have.class',
        'tab-drop-left'
      )
    })

    it('drops onto the tablist to move a tab to the end', function () {
      // Open three tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')

      // Drag main to the tablist gutter (right of last tab)
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(TAB_TRANSFER_TYPE, DOC_IDS.main)

      cy.findByRole('tab', { name: /main\.tex/ }).trigger('dragstart', {
        dataTransfer,
      })

      cy.findByRole('tablist').trigger('dragover', { dataTransfer })
      cy.findByRole('tablist').trigger('drop', { dataTransfer })

      // main should now be last
      cy.findAllByRole('tab').last().should('contain.text', 'main.tex')
    })

    it('does nothing when dropping a tab on itself', function () {
      // Open two tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))

      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'intro.tex')

      // Drag main onto itself
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(TAB_TRANSFER_TYPE, DOC_IDS.main)

      cy.findByRole('tab', { name: /main\.tex/ }).trigger('dragstart', {
        dataTransfer,
      })

      cy.findByRole('tab', { name: /main\.tex/ }).then($el => {
        const rect = $el[0].getBoundingClientRect()
        cy.wrap($el).trigger('dragover', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.75,
        })
        cy.wrap($el).trigger('drop', {
          dataTransfer,
          clientX: rect.left + rect.width * 0.75,
        })
      })

      // Order unchanged
      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')
      cy.findAllByRole('tab').eq(1).should('contain.text', 'intro.tex')
    })
  })

  describe('Path disambiguation for duplicate names', function () {
    const duplicateNameRootFolder = makeRootFolder(
      [{ _id: DOC_IDS.main, name: 'main.tex' }],
      [
        {
          _id: FOLDER_IDS.chapterA,
          name: 'chapter-a',
          docs: [{ _id: DOC_IDS.introA, name: 'intro.tex' }],
          folders: [],
          fileRefs: [],
        },
        {
          _id: FOLDER_IDS.chapterB,
          name: 'chapter-b',
          docs: [{ _id: DOC_IDS.introB, name: 'intro.tex' }],
          folders: [],
          fileRefs: [],
        },
      ]
    )

    it('shows disambiguated paths when two files share the same name', function () {
      mountTabs({ rootFolder: duplicateNameRootFolder })

      // Open main.tex (unique name, no disambiguation needed)
      cy.then(() => selectDoc(DOC_IDS.main))

      // Open intro.tex from chapter-a
      cy.then(() =>
        selectDoc(DOC_IDS.introA, ['root-folder-id', FOLDER_IDS.chapterA])
      )

      // Open intro.tex from chapter-b
      cy.then(() =>
        selectDoc(DOC_IDS.introB, ['root-folder-id', FOLDER_IDS.chapterB])
      )

      cy.findAllByRole('tab').should('have.length', 3)

      // main.tex is unique — should display without a path prefix
      cy.findAllByRole('tab').eq(0).should('contain.text', 'main.tex')

      // The two intro.tex tabs should be disambiguated with their folder names
      cy.findAllByRole('tab')
        .eq(1)
        .should('contain.text', 'chapter-a/intro.tex')
      cy.findAllByRole('tab')
        .eq(2)
        .should('contain.text', 'chapter-b/intro.tex')
    })

    it('uses only the file name when there is no collision', function () {
      mountTabs({ rootFolder: duplicateNameRootFolder })

      // Open just one of the duplicate-named files
      cy.then(() =>
        selectDoc(DOC_IDS.introA, ['root-folder-id', FOLDER_IDS.chapterA])
      )

      // With only one intro.tex open, no disambiguation is needed
      cy.findByRole('tab', { name: /intro\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /intro\.tex/ }).should(
        'not.contain.text',
        'chapter-a/'
      )
    })
  })

  describe('Multiple file types', function () {
    it('displays tabs for both docs and file refs', function () {
      const rootFolder = makeRootFolder(
        [{ _id: DOC_IDS.main, name: 'main.tex' }],
        [],
        [{ _id: DOC_IDS.bibFile, name: 'refs.bib' }]
      )

      mountTabs({ rootFolder })

      // Open main doc
      cy.then(() => selectDoc(DOC_IDS.main))

      // Open a fileRef
      cy.then(() =>
        selectEntity(makeFileRefEntity(DOC_IDS.bibFile, 'refs.bib'))
      )

      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
      cy.findByRole('tab', { name: /refs\.bib/ }).should('exist')
    })
  })

  describe('Tab scrolling', function () {
    it('scrolls the selected tab into view', function () {
      const manyDocs = [
        { _id: DOC_IDS.main, name: 'main.tex' },
        ...Array.from({ length: 10 }, (_, i) => ({
          _id: `ch${i + 1}`,
          name: `chapter-${i + 1}.tex`,
        })),
      ]
      const rootFolder = makeRootFolder(manyDocs)
      mountTabs({ rootFolder })

      // Open main
      cy.then(() => selectDoc(DOC_IDS.main))

      // Open all chapter tabs first so they push main.tex out of view
      for (let i = 1; i <= 10; i++) {
        const id = `ch${i}`
        cy.then(() => selectEntity(makeDocEntity(id, `chapter-${i}.tex`)))
        cy.get('@editorView').type('a')
        cy.findByRole('tab', { name: new RegExp(`chapter-${i}.tex`) }).should(
          'be.visible'
        )
      }

      // Now select main again — it should be scrolled back into view
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ }).should('be.visible')
    })

    it('scrolls horizontally on vertical mouse wheel', function () {
      const manyDocs = [
        { _id: DOC_IDS.main, name: 'main.tex' },
        ...Array.from({ length: 10 }, (_, i) => ({
          _id: `ch${i + 1}`,
          name: `chapter-${i + 1}.tex`,
        })),
      ]
      const rootFolder = makeRootFolder(manyDocs)
      mountTabs({ rootFolder })

      // Open enough tabs to cause overflow
      cy.then(() => selectDoc(DOC_IDS.main))
      for (let i = 1; i <= 10; i++) {
        const id = `ch${i}`
        cy.then(() => selectEntity(makeDocEntity(id, `chapter-${i}.tex`)))
      }

      // Scroll back to the start
      cy.findByRole('tablist').then($el => {
        $el[0].scrollLeft = 0
      })

      // Trigger a vertical wheel event on the tablist
      cy.findByRole('tablist').trigger('wheel', { deltaY: 100, deltaX: 0 })

      // scrollLeft should have increased
      cy.findByRole('tablist').should($el => {
        expect($el[0].scrollLeft).to.be.greaterThan(0)
      })
    })
  })

  describe('Pruning deleted files', function () {
    it('prunes persisted tabs whose files are no longer in the tree', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      // Re-mount with a tree containing only appendix.tex, then verify
      // the last remaining tab cannot be closed
      const trimmedRootFolder = makeRootFolder([
        { _id: DOC_IDS.appendix, name: 'appendix.tex' },
      ])
      mountTabs({ rootFolder: trimmedRootFolder })

      cy.findAllByRole('tab').should('have.length', 1)
      cy.findByRole('tab', { name: /appendix\.tex/ }).should('exist')

      cy.findByRole('tab', { name: /appendix\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close' }).should('be.disabled')
      })
    })
  })

  describe('Review panel header', function () {
    function toggleReviewPanel() {
      cy.window().then(win => {
        win.dispatchEvent(new win.CustomEvent('ui.toggle-review-panel'))
      })
    }

    it('does not render the review panel header when the review panel is closed', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('heading', { name: 'Review' }).should('not.exist')
    })

    it('renders the review panel header inside the tabs container when the review panel is open', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      toggleReviewPanel()

      cy.get('.editor-tabs-container').within(() => {
        cy.findByRole('heading', { name: 'Review' }).should('exist')
      })
    })

    it('removes the review panel header when the review panel is closed again', function () {
      cy.then(() => selectDoc(DOC_IDS.main))

      toggleReviewPanel()
      cy.findByRole('heading', { name: 'Review' }).should('exist')

      toggleReviewPanel()

      cy.findByRole('heading', { name: 'Review' }).should('not.exist')
    })
  })

  describe('SplitTestBadge', function () {
    it('renders the labs badge icon in the tabs container', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-splitTestInfo', {
          'editor-tabs': {
            phase: 'beta',
            badgeInfo: {
              url: '/beta/editor-tabs',
              tooltipText: 'Editor tabs are in beta',
            },
          },
        })
      })

      mountTabs()

      cy.then(() => selectDoc(DOC_IDS.main))

      cy.get('.editor-tabs-labs-icon').should('exist')
    })
  })
})
