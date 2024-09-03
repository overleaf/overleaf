import { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../shared/hooks/use-scope-event-emitter'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useScopeEventListener from '../../../shared/hooks/use-scope-event-listener'
import { createExtensions } from '../extensions'
import {
  lineHeights,
  setEditorTheme,
  setOptionsTheme,
} from '../extensions/theme'
import {
  restoreCursorPosition,
  setCursorLineAndScroll,
  setCursorPositionAndScroll,
} from '../extensions/cursor-position'
import {
  setAnnotations,
  showCompileLogDiagnostics,
} from '../extensions/annotations'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { setCursorHighlights } from '../extensions/cursor-highlights'
import {
  setLanguage,
  setMetadata,
  setSyntaxValidation,
} from '../extensions/language'
import { restoreScrollPosition } from '../extensions/scroll-position'
import { setEditable } from '../extensions/editable'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { setAutoPair } from '../extensions/auto-pair'
import { setAutoComplete } from '../extensions/auto-complete'
import { usePhrases } from './use-phrases'
import { setPhrases } from '../extensions/phrases'
import {
  addLearnedWord,
  removeLearnedWord,
  resetLearnedWords,
  setSpelling,
} from '../extensions/spelling'
import {
  createChangeManager,
  dispatchEditorEvent,
  reviewPanelToggled,
} from '../extensions/changes/change-manager'
import { setKeybindings } from '../extensions/keybindings'
import { Highlight } from '../../../../../types/highlight'
import { EditorView } from '@codemirror/view'
import { useErrorHandler } from 'react-error-boundary'
import { setVisual } from '../extensions/visual/visual'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { setDocName } from '@/features/source-editor/extensions/doc-name'
import isValidTexFile from '@/main/is-valid-tex-file'
import { captureException } from '@/infrastructure/error-reporter'
import grammarlyExtensionPresent from '@/shared/utils/grammarly'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { useLayoutContext } from '@/shared/context/layout-context'
import { debugConsole } from '@/utils/debugging'
import { useMetadataContext } from '@/features/ide-react/context/metadata-context'
import { useUserContext } from '@/shared/context/user-context'
import { useReferencesContext } from '@/features/ide-react/context/references-context'
import { setMathPreview } from '@/features/source-editor/extensions/math-preview'
import { useRangesContext } from '@/features/review-panel-new/context/ranges-context'
import { updateRanges } from '@/features/source-editor/extensions/ranges'
import { useThreadsContext } from '@/features/review-panel-new/context/threads-context'

function useCodeMirrorScope(view: EditorView) {
  const { fileTreeData } = useFileTreeData()

  const [permissions] = useScopeValue<{ write: boolean }>('permissions')

  // set up scope listeners

  const { logEntryAnnotations, editedSinceCompileStarted, compiling } =
    useCompileContext()

  const { reviewPanelOpen, miniReviewPanelVisible } = useLayoutContext()

  const metadata = useMetadataContext()

  const [loadingThreads] = useScopeValue<boolean>('loadingThreads')

  const [currentDoc] = useScopeValue<DocumentContainer | null>(
    'editor.sharejs_doc'
  )
  const [docName] = useScopeValue<string>('editor.open_doc_name')
  const [trackChanges] = useScopeValue<boolean>('editor.trackChanges')

  const { id: userId } = useUserContext()
  const { userSettings } = useUserSettingsContext()
  const {
    fontFamily,
    fontSize,
    lineHeight,
    overallTheme,
    autoComplete,
    editorTheme,
    autoPairDelimiters,
    mode,
    syntaxValidation,
    mathPreview,
  } = userSettings

  const [cursorHighlights] = useScopeValue<Record<string, Highlight[]>>(
    'onlineUserCursorHighlights'
  )

  const [spellCheckLanguage] = useScopeValue<string>(
    'project.spellCheckLanguage'
  )

  const [visual] = useScopeValue<boolean>('editor.showVisual')

  const { referenceKeys } = useReferencesContext()

  const ranges = useRangesContext()
  const threads = useThreadsContext()

  // build the translation phrases
  const phrases = usePhrases()

  const phrasesRef = useRef(phrases)

  // initialise the local state

  const themeRef = useRef({
    fontFamily,
    fontSize,
    lineHeight,
    overallTheme,
    editorTheme,
  })

  useEffect(() => {
    themeRef.current = {
      fontFamily,
      fontSize,
      lineHeight,
      overallTheme,
      editorTheme,
    }

    view.dispatch(
      setOptionsTheme({
        fontFamily,
        fontSize,
        lineHeight,
        overallTheme,
      })
    )

    setEditorTheme(editorTheme).then(spec => {
      view.dispatch(spec)
    })
  }, [view, fontFamily, fontSize, lineHeight, overallTheme, editorTheme])

  const settingsRef = useRef({
    autoComplete,
    autoPairDelimiters,
    mode,
    syntaxValidation,
    mathPreview,
  })

  const currentDocRef = useRef({
    currentDoc,
    trackChanges,
    loadingThreads,
    threads,
    ranges,
  })

  useEffect(() => {
    if (currentDoc) {
      currentDocRef.current.currentDoc = currentDoc
    }
  }, [view, currentDoc])

  useEffect(() => {
    currentDocRef.current.ranges = ranges
    currentDocRef.current.threads = threads
    if (ranges && threads) {
      window.setTimeout(() => {
        view.dispatch(updateRanges({ ranges, threads }))
      })
    }
  }, [view, ranges, threads])

  const docNameRef = useRef(docName)

  useEffect(() => {
    currentDocRef.current.loadingThreads = loadingThreads
  }, [view, loadingThreads])

  useEffect(() => {
    currentDocRef.current.trackChanges = trackChanges

    if (currentDoc) {
      if (trackChanges) {
        currentDoc.track_changes_as = userId || 'anonymous'
      } else {
        currentDoc.track_changes_as = null
      }
    }
  }, [userId, currentDoc, trackChanges])

  useEffect(() => {
    if (lineHeight && fontSize) {
      dispatchEditorEvent('line-height', lineHeights[lineHeight] * fontSize)
    }
  }, [lineHeight, fontSize])

  const spellingRef = useRef({
    spellCheckLanguage,
  })

  useEffect(() => {
    spellingRef.current = {
      spellCheckLanguage,
    }
    view.dispatch(setSpelling(spellingRef.current))
  }, [view, spellCheckLanguage])

  // listen to doc:after-opened, and focus the editor
  useEffect(() => {
    const listener = () => {
      scheduleFocus(view)
    }
    window.addEventListener('doc:after-opened', listener)
    return () => window.removeEventListener('doc:after-opened', listener)
  }, [view])

  // set the project metadata, mostly for use in autocomplete
  // TODO: read this data from the scope?
  const metadataRef = useRef({
    ...metadata,
    referenceKeys,
    fileTreeData,
  })

  // listen to project metadata (commands, labels and package names) updates
  useEffect(() => {
    metadataRef.current = { ...metadataRef.current, ...metadata }
    window.setTimeout(() => {
      view.dispatch(setMetadata(metadataRef.current))
    })
  }, [view, metadata])

  // listen to project reference keys updates
  useEffect(() => {
    metadataRef.current.referenceKeys = referenceKeys
    window.setTimeout(() => {
      view.dispatch(setMetadata(metadataRef.current))
    })
  }, [view, referenceKeys])

  // listen to project root folder updates
  useEffect(() => {
    if (fileTreeData) {
      metadataRef.current.fileTreeData = fileTreeData
      window.setTimeout(() => {
        view.dispatch(setMetadata(metadataRef.current))
      })
    }
  }, [view, fileTreeData])

  const editableRef = useRef(permissions.write)

  const { previewByPath } = useFileTreePathContext()

  const showVisual = visual && isValidTexFile(docName)

  const visualRef = useRef({
    previewByPath,
    visual: showVisual,
  })

  const handleError = useErrorHandler()

  const handleException = useCallback((exception: any) => {
    captureException(exception, {
      tags: {
        handler: 'cm6-exception',
        // which editor mode is active ('visual' | 'code')
        ol_editor_mode: visualRef.current.visual ? 'visual' : 'code',
        // which editor keybindings are active ('default' | 'vim' | 'emacs')
        ol_editor_keybindings: settingsRef.current.mode,
        // whether Writefull is present ('extension' | 'integration' | 'none')
        ol_extensions_writefull: window.writefull?.type ?? 'none',
        // whether Grammarly is present
        ol_extensions_grammarly: grammarlyExtensionPresent(),
      },
    })
  }, [])

  // create a new state when currentDoc changes

  useEffect(() => {
    if (currentDoc) {
      debugConsole.log('creating new editor state')

      const state = EditorState.create({
        doc: currentDoc.getSnapshot(),
        extensions: createExtensions({
          currentDoc: {
            ...currentDocRef.current,
            currentDoc,
          },
          docName: docNameRef.current,
          theme: themeRef.current,
          metadata: metadataRef.current,
          settings: settingsRef.current,
          phrases: phrasesRef.current,
          spelling: spellingRef.current,
          visual: visualRef.current,
          changeManager: createChangeManager(view, currentDoc),
          handleError,
          handleException,
        }),
      })
      view.setState(state)

      // synchronous config
      view.dispatch(
        restoreCursorPosition(state.doc, currentDoc.doc_id),
        setEditable(editableRef.current),
        setOptionsTheme(themeRef.current)
      )

      // asynchronous config
      setEditorTheme(themeRef.current.editorTheme).then(spec => {
        view.dispatch(spec)
      })

      setKeybindings(settingsRef.current.mode).then(spec => {
        view.dispatch(spec)
      })

      if (!visualRef.current.visual) {
        window.setTimeout(() => {
          view.dispatch(restoreScrollPosition())
          view.focus()
        })
      }
    }
    // IMPORTANT: This effect must not depend on anything variable apart from currentDoc,
    // as the editor state is recreated when the effect runs.
  }, [view, currentDoc, handleError, handleException])

  useEffect(() => {
    if (docName) {
      docNameRef.current = docName

      view.dispatch(
        setDocName(docNameRef.current),
        setLanguage(
          docNameRef.current,
          metadataRef.current,
          settingsRef.current.syntaxValidation
        )
      )
    }
  }, [view, docName])

  useEffect(() => {
    visualRef.current.visual = showVisual
    view.dispatch(setVisual(visualRef.current))
    view.dispatch({
      effects: EditorView.scrollIntoView(view.state.selection.main.head),
    })
    // clear performance measures and marks when switching between Source and Rich Text
    window.dispatchEvent(new Event('editor:visual-switch'))
  }, [view, showVisual])

  useEffect(() => {
    visualRef.current.previewByPath = previewByPath
    view.dispatch(setVisual(visualRef.current))
  }, [view, previewByPath])

  useEffect(() => {
    editableRef.current = permissions.write
    view.dispatch(setEditable(editableRef.current)) // the editor needs to be locked when there's a problem saving data
  }, [view, permissions.write])

  useEffect(() => {
    phrasesRef.current = phrases
    view.dispatch(setPhrases(phrases))
  }, [view, phrases])

  // listen to editor settings updates
  useEffect(() => {
    settingsRef.current.autoPairDelimiters = autoPairDelimiters
    view.dispatch(setAutoPair(autoPairDelimiters))
  }, [view, autoPairDelimiters])

  useEffect(() => {
    settingsRef.current.autoComplete = autoComplete
    view.dispatch(setAutoComplete(autoComplete))
  }, [view, autoComplete])

  useEffect(() => {
    settingsRef.current.mode = mode
    setKeybindings(mode).then(spec => {
      view.dispatch(spec)
    })
  }, [view, mode])

  useEffect(() => {
    settingsRef.current.syntaxValidation = syntaxValidation
    view.dispatch(setSyntaxValidation(syntaxValidation))
  }, [view, syntaxValidation])

  useEffect(() => {
    settingsRef.current.mathPreview = mathPreview
    view.dispatch(setMathPreview(mathPreview))
  }, [view, mathPreview])

  const emitSyncToPdf = useScopeEventEmitter('cursor:editor:syncToPdf')

  const handleGoToLine = useCallback(
    (event, lineNumber, columnNumber, syncToPdf) => {
      setCursorLineAndScroll(view, lineNumber, columnNumber)
      if (syncToPdf) {
        emitSyncToPdf()
      }
    },
    [emitSyncToPdf, view]
  )

  // select and scroll to position on editor:gotoLine event (from synctex)
  useScopeEventListener('editor:gotoLine', handleGoToLine)

  const handleGoToOffset = useCallback(
    (event, offset) => {
      setCursorPositionAndScroll(view, offset)
    },
    [view]
  )

  // select and scroll to position on editor:gotoOffset event (from review panel)
  useScopeEventListener('editor:gotoOffset', handleGoToOffset)

  // dispatch 'cursor:editor:update' to Angular scope (for synctex and realtime)
  const dispatchCursorUpdate = useScopeEventEmitter('cursor:editor:update')

  const handleCursorUpdate = useCallback(
    (event: CustomEvent) => {
      dispatchCursorUpdate(event.detail)
    },
    [dispatchCursorUpdate]
  )

  // listen for 'cursor:editor:update' events from CodeMirror, and dispatch them to Angular
  useEventListener('cursor:editor:update', handleCursorUpdate)

  // dispatch 'cursor:editor:update' to Angular scope (for outline)
  const dispatchScrollUpdate = useScopeEventEmitter('scroll:editor:update')

  const handleScrollUpdate = useCallback(
    (event: CustomEvent) => {
      dispatchScrollUpdate(event.detail)
    },
    [dispatchScrollUpdate]
  )

  // listen for 'cursor:editor:update' events from CodeMirror, and dispatch them to Angular
  useEventListener('scroll:editor:update', handleScrollUpdate)

  // enable the compile log linter a) when "Code Check" is off, b) when the project hasn't changed and isn't compiling.
  // the project "changed at" date is reset at the start of the compile, i.e. "the project hasn't changed",
  // but we don't want to display the compile log diagnostics from the previous compile.
  const enableCompileLogLinter =
    !syntaxValidation || (!editedSinceCompileStarted && !compiling)

  // store enableCompileLogLinter in a ref for use in useEffect
  const enableCompileLogLinterRef = useRef(enableCompileLogLinter)

  useEffect(() => {
    enableCompileLogLinterRef.current = enableCompileLogLinter
  }, [enableCompileLogLinter])

  // enable/disable the compile log linter as appropriate
  useEffect(() => {
    // dispatch in a timeout, so the dispatch isn't in the same cycle as the edit which caused it
    window.setTimeout(() => {
      view.dispatch(showCompileLogDiagnostics(enableCompileLogLinter))
    }, 0)
  }, [view, enableCompileLogLinter])

  // set the compile log annotations when they change
  useEffect(() => {
    if (currentDoc && logEntryAnnotations) {
      const annotations = logEntryAnnotations[currentDoc.doc_id]

      // dispatch in a timeout, so the dispatch isn't in the same cycle as the edit which caused it
      window.setTimeout(() => {
        view.dispatch(
          setAnnotations(view.state, annotations || []),
          // reconfigure the compile log lint source, so it runs once with the new data
          showCompileLogDiagnostics(enableCompileLogLinterRef.current)
        )
      })
    }
  }, [view, currentDoc, logEntryAnnotations])

  const highlightsRef = useRef<{ cursorHighlights: Highlight[] }>({
    cursorHighlights: [],
  })

  useEffect(() => {
    if (cursorHighlights && currentDoc) {
      const items = cursorHighlights[currentDoc.doc_id]
      highlightsRef.current.cursorHighlights = items
      window.setTimeout(() => {
        view.dispatch(setCursorHighlights(items))
      })
    }
  }, [view, cursorHighlights, currentDoc])

  const handleAddLearnedWords = useCallback(
    (event: CustomEvent<string>) => {
      // If the word addition is from adding the word to the dictionary via the
      // editor, there will be a transaction running now so wait for that to
      // finish before starting a new one
      window.setTimeout(() => {
        view.dispatch(addLearnedWord(spellCheckLanguage, event.detail))
      }, 0)
    },
    [spellCheckLanguage, view]
  )

  useEventListener('learnedWords:add', handleAddLearnedWords)

  const handleRemoveLearnedWords = useCallback(
    (event: CustomEvent<string>) => {
      view.dispatch(removeLearnedWord(spellCheckLanguage, event.detail))
    },
    [spellCheckLanguage, view]
  )

  useEventListener('learnedWords:remove', handleRemoveLearnedWords)

  const handleResetLearnedWords = useCallback(() => {
    view.dispatch(resetLearnedWords())
  }, [view])

  useEventListener('learnedWords:reset', handleResetLearnedWords)

  useEffect(() => {
    view.dispatch(reviewPanelToggled())
  }, [reviewPanelOpen, miniReviewPanelVisible, view])
}

export default useCodeMirrorScope

const scheduleFocus = (view: EditorView) => {
  window.setTimeout(() => {
    view.focus()
  }, 0)
}
