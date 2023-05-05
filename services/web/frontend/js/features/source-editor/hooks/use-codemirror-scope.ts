import { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../shared/hooks/use-scope-event-emitter'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useScopeEventListener from '../../../shared/hooks/use-scope-event-listener'
import { createExtensions } from '../extensions'
import {
  FontFamily,
  LineHeight,
  lineHeights,
  OverallTheme,
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
import { setMetadata, setSyntaxValidation } from '../extensions/language'
import { useIdeContext } from '../../../shared/context/ide-context'
import { restoreScrollPosition } from '../extensions/scroll-position'
import { setEditable } from '../extensions/editable'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useEditorContext } from '../../../shared/context/editor-context'
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
import { createChangeManager } from '../extensions/changes/change-manager'
import { setKeybindings } from '../extensions/keybindings'
import { Highlight } from '../../../../../types/highlight'
import { EditorView } from '@codemirror/view'
import { CurrentDoc } from '../../../../../types/current-doc'
import { useErrorHandler } from 'react-error-boundary'
import { setVisual } from '../extensions/visual/visual'

function useCodeMirrorScope(view: EditorView) {
  const ide = useIdeContext()

  const { fileTreeData } = useFileTreeData()
  const { permissionsLevel } = useEditorContext()

  // set up scope listeners

  const { logEntryAnnotations, editedSinceCompileStarted, compiling } =
    useCompileContext()

  const [loadingThreads] = useScopeValue<boolean>('loadingThreads')

  const [currentDoc] = useScopeValue<CurrentDoc | null>('editor.sharejs_doc')
  const [docName] = useScopeValue<string>('editor.open_doc_name')
  const [trackChanges] = useScopeValue<boolean>('editor.trackChanges')

  const [fontFamily] = useScopeValue<FontFamily>('settings.fontFamily')
  const [fontSize] = useScopeValue<number>('settings.fontSize')
  const [lineHeight] = useScopeValue<LineHeight>('settings.lineHeight')
  const [overallTheme] = useScopeValue<OverallTheme>('settings.overallTheme')
  const [autoComplete] = useScopeValue<boolean>('settings.autoComplete')
  const [editorTheme] = useScopeValue<string>('settings.editorTheme')
  const [autoPairDelimiters] = useScopeValue<boolean>(
    'settings.autoPairDelimiters'
  )
  const [mode] = useScopeValue<string>('settings.mode')
  const [syntaxValidation] = useScopeValue<boolean>('settings.syntaxValidation')

  const [cursorHighlights] = useScopeValue<Record<string, Highlight[]>>(
    'onlineUserCursorHighlights'
  )

  const [spellCheckLanguage] = useScopeValue<string>(
    'project.spellCheckLanguage'
  )

  const [visual] = useScopeValue<boolean>('editor.showVisual')

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
  })

  const currentDocRef = useRef({
    currentDoc,
    docName,
    trackChanges,
    loadingThreads,
  })

  useEffect(() => {
    if (currentDoc) {
      currentDocRef.current.currentDoc = currentDoc
    }
  }, [view, currentDoc])

  useEffect(() => {
    if (docName) {
      currentDocRef.current.docName = docName
    }
  }, [view, docName])

  useEffect(() => {
    currentDocRef.current.loadingThreads = loadingThreads
  }, [view, loadingThreads])

  useEffect(() => {
    currentDocRef.current.trackChanges = trackChanges

    if (currentDoc) {
      if (trackChanges) {
        currentDoc.track_changes_as = window.user.id || 'anonymous'
      } else {
        currentDoc.track_changes_as = null
      }
    }
  }, [currentDoc, trackChanges])

  useEffect(() => {
    if (lineHeight && fontSize) {
      window.dispatchEvent(
        new CustomEvent('editor:event', {
          detail: {
            type: 'line-height',
            payload: lineHeights[lineHeight] * fontSize,
          },
        })
      )
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
    documents: ide.metadataManager.metadata.state.documents,
    references: ide.$scope.$root._references.keys,
    fileTreeData,
  })

  // listen to project metadata (docs + packages) updates
  useEffect(() => {
    const listener = (event: Event) => {
      metadataRef.current.documents = (
        event as CustomEvent<Record<string, any>>
      ).detail
      view.dispatch(setMetadata(metadataRef.current))
    }
    window.addEventListener('project:metadata', listener)
    return () => window.removeEventListener('project:metadata', listener)
  }, [view])

  // listen to project reference keys updates
  useEffect(() => {
    const listener = (event: Event) => {
      metadataRef.current.references = (event as CustomEvent<string[]>).detail
      view.dispatch(setMetadata(metadataRef.current))
    }
    window.addEventListener('project:references', listener)
    return () => window.removeEventListener('project:references', listener)
  }, [view])

  // listen to project root folder updates
  useEffect(() => {
    if (fileTreeData) {
      metadataRef.current.fileTreeData = fileTreeData
      view.dispatch(setMetadata(metadataRef.current))
    }
  }, [view, fileTreeData])

  const editableRef = useRef(permissionsLevel !== 'readOnly')

  const visualRef = useRef({
    fileTreeManager: ide.fileTreeManager,
    visual,
  })

  const handleError = useErrorHandler()

  // create a new state when currentDoc changes

  useEffect(() => {
    if (currentDoc) {
      const state = EditorState.create({
        doc: currentDoc.getSnapshot(),
        extensions: createExtensions({
          currentDoc: {
            ...currentDocRef.current,
            currentDoc,
          },
          theme: themeRef.current,
          metadata: metadataRef.current,
          settings: settingsRef.current,
          phrases: phrasesRef.current,
          spelling: spellingRef.current,
          visual: visualRef.current,
          changeManager: createChangeManager(view, currentDoc),
          handleError,
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
  }, [view, currentDoc, handleError])

  useEffect(() => {
    visualRef.current.visual = visual
    view.dispatch(setVisual(visualRef.current))
    view.dispatch({
      effects: EditorView.scrollIntoView(view.state.selection.main.head),
    })
    // clear performance measures and marks when switching between Source and Rich Text
    window.dispatchEvent(new Event('editor:visual-switch'))
  }, [view, visual])

  useEffect(() => {
    editableRef.current = permissionsLevel !== 'readOnly'
    view.dispatch(setEditable(editableRef.current)) // the editor needs to be locked when there's a problem saving data
  }, [view, permissionsLevel])

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
          setAnnotations(view.state.doc, annotations || []),
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
}

export default useCodeMirrorScope

const scheduleFocus = (view: EditorView) => {
  window.setTimeout(() => {
    view.focus()
  }, 0)
}
