import React, { FC, useEffect, useRef } from 'react'
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
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'

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

// Rendered inside the provider tree to call handleFileTreeSelect() when a
// custom DOM event fires. Also triggers handleFileTreeInit() on mount.
function FileSelectionDriver({
  autoSelectEntity,
}: {
  autoSelectEntity?: FileTreeDocumentFindResult | FileTreeFileRefFindResult
} = {}) {
  const { handleFileTreeSelect, handleFileTreeInit } = useFileTreeOpenContext()
  const initDone = useRef(false)

  useEffect(() => {
    if (!initDone.current) {
      initDone.current = true
      handleFileTreeInit()
      if (autoSelectEntity) {
        handleFileTreeSelect([autoSelectEntity])
      }
    }
  }, [handleFileTreeInit, handleFileTreeSelect, autoSelectEntity])

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent
      handleFileTreeSelect([detail])
    }
    document.addEventListener('test:selectEntity', handler)
    return () => {
      document.removeEventListener('test:selectEntity', handler)
    }
  }, [handleFileTreeSelect])

  return null
}

// Dispatch a custom event to select an entity (simulates file-tree click).
// Must be wrapped in cy.then() so it runs in the Cypress command queue.
function selectEntity(
  entity: FileTreeDocumentFindResult | FileTreeFileRefFindResult
) {
  document.dispatchEvent(
    new CustomEvent('test:selectEntity', { detail: entity })
  )
  cy.findByRole('tab', { name: new RegExp(entity.entity.name) }).should('exist')
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
        }}
      >
        <FileSelectionDriver />
        <TabsContainer />
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
        if (key.startsWith('open-tabs:')) {
          win.localStorage.removeItem(key)
        }
      })
    })
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })

    mountTabs()
  })

  describe('Initial file selection', function () {
    it('automatically creates a tab for the initially opened file', function () {
      // Re-mount with auto-selection of the root doc to simulate
      // the file tree opening the initial document on startup
      cy.mount(
        <EditorProviders
          rootFolder={defaultRootFolder as any}
          rootDocId={DOC_IDS.main}
          providers={{
            EditorManagerProvider: makeEditorManagerProvider(),
          }}
        >
          <FileSelectionDriver
            autoSelectEntity={makeDocEntity(
              DOC_IDS.intro,
              DOC_NAMES[DOC_IDS.intro]
            )}
          />
          <TabsContainer />
        </EditorProviders>
      )

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
      cy.get('body').type('a')

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

      cy.get('body').type('a')

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
      cy.get('body').type('a')

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
        cy.findByRole('button', { name: 'Close tab' }).click()
      })

      cy.findByRole('tab', { name: /intro\.tex/ }).should('not.exist')
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
    })

    it('cannot close the last remaining tab', function () {
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.findAllByRole('tab').should('have.length', 1)

      // Attempt to close the only tab
      cy.findByRole('tab', { name: /main\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close tab' }).click()
      })

      // Tab must still exist
      cy.findByRole('tab', { name: /main\.tex/ }).should('exist')
      cy.findAllByRole('tab').should('have.length', 1)
    })

    it('switches to an adjacent tab when closing the currently active tab', function () {
      // Open three tabs
      cy.then(() => selectDoc(DOC_IDS.main))
      cy.then(() => selectDoc(DOC_IDS.intro))
      cy.then(() => selectDoc(DOC_IDS.appendix))

      cy.findAllByRole('tab').should('have.length', 3)

      // Close the currently selected tab (appendix — the last one selected)
      cy.findByRole('tab', { name: /appendix\.tex/ }).within(() => {
        cy.findByRole('button', { name: 'Close tab' }).click()
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

  describe('Tab scroll into view', function () {
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
        cy.get('body').type('a')
        cy.findByRole('tab', { name: new RegExp(`chapter-${i}.tex`) }).should(
          'be.visible'
        )
      }

      // Now select main again — it should be scrolled back into view
      cy.then(() => selectDoc(DOC_IDS.main))

      cy.findByRole('tab', { name: /main\.tex/ }).should('be.visible')
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
