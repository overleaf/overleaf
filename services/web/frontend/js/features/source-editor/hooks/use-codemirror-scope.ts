import { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../shared/hooks/use-scope-event-emitter'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useScopeEventListener from '../../../shared/hooks/use-scope-event-listener'
import { createExtensions } from '../extensions'
import { setEditorTheme, setOptionsTheme } from '../extensions/theme'
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
import { setSpellCheckLanguage } from '../extensions/spelling'
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
import { isValidTeXFile } from '@/main/is-valid-tex-file'
import { captureException } from '@/infrastructure/error-reporter'
import grammarlyExtensionPresent from '@/shared/utils/grammarly'
import { useLayoutContext } from '@/shared/context/layout-context'
import { debugConsole } from '@/utils/debugging'
import { useMetadataContext } from '@/features/ide-react/context/metadata-context'
import { useUserContext } from '@/shared/context/user-context'
import { useReferencesContext } from '@/features/ide-react/context/references-context'
import { setMathPreview } from '@/features/source-editor/extensions/math-preview'
import { useRangesContext } from '@/features/review-panel-new/context/ranges-context'
import { updateRanges } from '@/features/source-editor/extensions/ranges'
import { useThreadsContext } from '@/features/review-panel-new/context/threads-context'
import { useHunspell } from '@/features/source-editor/hooks/use-hunspell'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'
import { Permissions } from '@/features/ide-react/types/permissions'
import { lineHeights } from '@/shared/utils/styles'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

function useCodeMirrorScope(view: EditorView) {
  const { fileTreeData } = useFileTreeData()

  const [permissions] = useScopeValue<Permissions>('permissions')

  // set up scope listeners

  const { logEntryAnnotations, editedSinceCompileStarted, compiling } =
    useCompileContext()

  const { reviewPanelOpen, miniReviewPanelVisible } = useLayoutContext()
  const { currentDocument, openDocName, trackChanges } =
    useEditorManagerContext()
  const metadata = useMetadataContext()

  const [loadingThreads] = useScopeValue<boolean>('loadingThreads')

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
    referencesSearchMode,
  } = userSettings

  const [cursorHighlights] = useScopeValue<Record<string, Highlight[]>>(
    'onlineUserCursorHighlights'
  )

  let [spellCheckLanguage] = useScopeValue<string>('project.spellCheckLanguage')
  // spell check is off when read-only
  if (!permissions.write && !permissions.trackedWrite) {
    spellCheckLanguage = ''
  }

  const [projectFeatures] =
    useScopeValue<Record<string, boolean | string | number | undefined>>(
      'project.features'
    )

  const hunspellManager = useHunspell(spellCheckLanguage)

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
    bootstrapVersion: 3 as 3 | 5,
  })

  useEffect(() => {
    themeRef.current = {
      fontFamily,
      fontSize,
      lineHeight,
      overallTheme,
      editorTheme,
      bootstrapVersion: isBootstrap5() ? 5 : 3,
    }

    view.dispatch(
      setOptionsTheme({
        fontFamily,
        fontSize,
        lineHeight,
        overallTheme,
        bootstrapVersion: themeRef.current.bootstrapVersion,
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
    referencesSearchMode,
  })

  const currentDocRef = useRef({
    currentDocument,
    trackChanges,
    loadingThreads,
  })

  useEffect(() => {
    if (currentDocument) {
      currentDocRef.current.currentDocument = currentDocument
    }
  }, [view, currentDocument])

  useEffect(() => {
    if (ranges && threads) {
      window.setTimeout(() => {
        view.dispatch(updateRanges({ ranges, threads }))
      })
    }
  }, [view, ranges, threads])

  const docNameRef = useRef(openDocName)

  useEffect(() => {
    currentDocRef.current.loadingThreads = loadingThreads
  }, [view, loadingThreads])

  useEffect(() => {
    currentDocRef.current.trackChanges = trackChanges

    if (currentDocument) {
      if (trackChanges) {
        currentDocument.track_changes_as = userId || 'anonymous'
      } else {
        currentDocument.track_changes_as = null
      }
    }
  }, [userId, currentDocument, trackChanges])

  useEffect(() => {
    if (lineHeight && fontSize) {
      dispatchEditorEvent('line-height', lineHeights[lineHeight] * fontSize)
    }
  }, [lineHeight, fontSize])

  const spellingRef = useRef({
    spellCheckLanguage,
    hunspellManager,
  })

  useEffect(() => {
    spellingRef.current = {
      spellCheckLanguage,
      hunspellManager,
    }
    window.setTimeout(() => {
      view.dispatch(setSpellCheckLanguage(spellingRef.current))
    })
  }, [view, spellCheckLanguage, hunspellManager])

  const projectFeaturesRef = useRef(projectFeatures)

  // listen to doc:after-opened, and focus the editor if it's not a new doc
  useEffect(() => {
    const listener: EventListener = event => {
      const { isNewDoc } = (event as CustomEvent<{ isNewDoc: boolean }>).detail

      if (!isNewDoc) {
        window.setTimeout(() => {
          view.focus()
        }, 0)
      }
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

  const editableRef = useRef(permissions.write || permissions.trackedWrite)

  const { previewByPath } = useFileTreePathContext()

  const showVisual = visual && !!openDocName && isValidTeXFile(openDocName)

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

  // create a new state when currentDocument changes

  useEffect(() => {
    if (currentDocument) {
      debugConsole.log('creating new editor state')

      const state = EditorState.create({
        doc: currentDocument.getSnapshot(),
        extensions: createExtensions({
          currentDoc: {
            ...currentDocRef.current,
            currentDoc: currentDocument,
          },
          docName: docNameRef.current,
          theme: themeRef.current,
          metadata: metadataRef.current,
          settings: settingsRef.current,
          phrases: phrasesRef.current,
          spelling: spellingRef.current,
          visual: visualRef.current,
          projectFeatures: projectFeaturesRef.current,
          changeManager: createChangeManager(view, currentDocument),
          handleError,
          handleException,
        }),
      })
      view.setState(state)

      // synchronous config
      view.dispatch(
        restoreCursorPosition(state.doc, currentDocument.doc_id),
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
    // IMPORTANT: This effect must not depend on anything variable apart from currentDocument,
    // as the editor state is recreated when the effect runs.
  }, [view, currentDocument, handleError, handleException])

  useEffect(() => {
    if (openDocName) {
      docNameRef.current = openDocName

      window.setTimeout(() => {
        view.dispatch(
          setDocName(openDocName),
          setLanguage(
            openDocName,
            metadataRef.current,
            settingsRef.current.syntaxValidation
          )
        )
      })
    }
  }, [view, openDocName])

  useEffect(() => {
    visualRef.current.visual = showVisual
    window.setTimeout(() => {
      view.dispatch(setVisual(visualRef.current))
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.selection.main.head),
      })
      // clear performance measures and marks when switching between Source and Rich Text
      window.dispatchEvent(new Event('editor:visual-switch'))
    })
  }, [view, showVisual])

  useEffect(() => {
    visualRef.current.previewByPath = previewByPath
    window.setTimeout(() => {
      view.dispatch(setVisual(visualRef.current))
    })
  }, [view, previewByPath])

  useEffect(() => {
    editableRef.current = permissions.write || permissions.trackedWrite
    window.setTimeout(() => {
      view.dispatch(setEditable(editableRef.current)) // the editor needs to be locked when there's a problem saving data
    })
  }, [view, permissions.write, permissions.trackedWrite])

  useEffect(() => {
    phrasesRef.current = phrases
    window.setTimeout(() => {
      view.dispatch(setPhrases(phrases))
    })
  }, [view, phrases])

  // listen to editor settings updates
  useEffect(() => {
    settingsRef.current.autoPairDelimiters = autoPairDelimiters
    window.setTimeout(() => {
      view.dispatch(setAutoPair(autoPairDelimiters))
    })
  }, [view, autoPairDelimiters])

  useEffect(() => {
    settingsRef.current.autoComplete = autoComplete
    window.setTimeout(() => {
      view.dispatch(
        setAutoComplete({
          enabled: autoComplete,
          projectFeatures: projectFeaturesRef.current,
          referencesSearchMode: settingsRef.current.referencesSearchMode,
        })
      )
    })
  }, [view, autoComplete])

  useEffect(() => {
    settingsRef.current.mode = mode
    setKeybindings(mode).then(spec => {
      window.setTimeout(() => {
        view.dispatch(spec)
      })
    })
  }, [view, mode])

  useEffect(() => {
    settingsRef.current.syntaxValidation = syntaxValidation
    window.setTimeout(() => {
      view.dispatch(setSyntaxValidation(syntaxValidation))
    })
  }, [view, syntaxValidation])

  useEffect(() => {
    settingsRef.current.mathPreview = mathPreview
    window.setTimeout(() => {
      view.dispatch(setMathPreview(mathPreview))
    })
  }, [view, mathPreview])

  useEffect(() => {
    settingsRef.current.referencesSearchMode = referencesSearchMode
  }, [referencesSearchMode])

  const emitSyncToPdf = useScopeEventEmitter('cursor:editor:syncToPdf')

  // select and scroll to position on editor:gotoLine event (from synctex)
  useScopeEventListener(
    'editor:gotoLine',
    useCallback(
      (_event, options) => {
        setCursorLineAndScroll(
          view,
          options.gotoLine,
          options.gotoColumn,
          options.selectText
        )
        if (options.syncToPdf) {
          emitSyncToPdf()
        }
      },
      [emitSyncToPdf, view]
    )
  )

  // select and scroll to position on editor:gotoOffset event (from review panel)
  useScopeEventListener(
    'editor:gotoOffset',
    useCallback(
      (_event, options) => {
        setCursorPositionAndScroll(view, options.gotoOffset)
      },
      [view]
    )
  )

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
    window.setTimeout(() => {
      view.dispatch(showCompileLogDiagnostics(enableCompileLogLinter))
    })
  }, [view, enableCompileLogLinter])

  // set the compile log annotations when they change
  useEffect(() => {
    if (currentDocument && logEntryAnnotations) {
      const annotations = logEntryAnnotations[currentDocument.doc_id]

      window.setTimeout(() => {
        view.dispatch(
          setAnnotations(view.state, annotations || []),
          // reconfigure the compile log lint source, so it runs once with the new data
          showCompileLogDiagnostics(enableCompileLogLinterRef.current)
        )
      })
    }
  }, [view, currentDocument, logEntryAnnotations])

  const highlightsRef = useRef<{ cursorHighlights: Highlight[] }>({
    cursorHighlights: [],
  })

  useEffect(() => {
    if (cursorHighlights && currentDocument) {
      const items = cursorHighlights[currentDocument.doc_id]
      highlightsRef.current.cursorHighlights = items
      window.setTimeout(() => {
        view.dispatch(setCursorHighlights(items))
      })
    }
  }, [view, cursorHighlights, currentDocument])

  useEventListener(
    'editor:focus',
    useCallback(() => {
      view.focus()
    }, [view])
  )

  useEffect(() => {
    window.setTimeout(() => {
      view.dispatch(reviewPanelToggled())
    })
  }, [reviewPanelOpen, miniReviewPanelVisible, view])
}

export default useCodeMirrorScope
