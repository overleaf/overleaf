import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import useEventListener from '@/shared/hooks/use-event-listener'
import * as eventTracking from '@/infrastructure/event-tracking'
import { isValidTeXFile } from '@/main/is-valid-tex-file'
import localStorage from '@/infrastructure/local-storage'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export type PartialFlatOutline = {
  level: number
  title: string
  line: number
}[]

export type FlatOutlineState =
  | {
      items: PartialFlatOutline
      partial: boolean
    }
  | undefined

const OutlineContext = createContext<
  | {
      flatOutline: FlatOutlineState
      setFlatOutline: Dispatch<SetStateAction<FlatOutlineState>>
      highlightedLine: number
      jumpToLine: (lineNumber: number, syncToPdf: boolean) => void
      canShowOutline: boolean
      outlineExpanded: boolean
      toggleOutlineExpanded: () => void
    }
  | undefined
>(undefined)

export const OutlineProvider: FC = ({ children }) => {
  const [flatOutline, setFlatOutline] = useState<FlatOutlineState>(undefined)
  const [currentlyHighlightedLine, setCurrentlyHighlightedLine] =
    useState<number>(-1)
  const [binaryFileOpened, setBinaryFileOpened] = useState<boolean>(false)
  const [ignoreNextCursorUpdate, setIgnoreNextCursorUpdate] =
    useState<boolean>(false)
  const [ignoreNextScroll, setIgnoreNextScroll] = useState<boolean>(false)

  const goToLineEmitter = useScopeEventEmitter('editor:gotoLine', true)

  useEventListener(
    'file-view:file-opened',
    useCallback(_ => {
      setBinaryFileOpened(true)
    }, [])
  )

  useEventListener(
    'scroll:editor:update',
    useCallback(
      evt => {
        if (ignoreNextScroll) {
          setIgnoreNextScroll(false)
          return
        }
        setCurrentlyHighlightedLine(evt.detail + 1)
      },
      [ignoreNextScroll]
    )
  )

  useEventListener(
    'cursor:editor:update',
    useCallback(
      evt => {
        if (ignoreNextCursorUpdate) {
          setIgnoreNextCursorUpdate(false)
          return
        }
        setCurrentlyHighlightedLine(evt.detail.row + 1)
      },
      [ignoreNextCursorUpdate]
    )
  )

  useEventListener(
    'doc:after-opened',
    useCallback(evt => {
      if (evt.detail.isNewDoc) {
        setIgnoreNextCursorUpdate(true)
      }
      setBinaryFileOpened(false)
      setIgnoreNextScroll(true)
    }, [])
  )

  const jumpToLine = useCallback(
    (lineNumber: number, syncToPdf: boolean) => {
      setIgnoreNextScroll(true)
      goToLineEmitter({
        gotoLine: lineNumber,
        gotoColumn: 0,
        syncToPdf,
      })
      eventTracking.sendMB('outline-jump-to-line')
    },
    [goToLineEmitter]
  )

  const highlightedLine = useMemo(
    () =>
      closestSectionLineNumber(flatOutline?.items, currentlyHighlightedLine),
    [flatOutline, currentlyHighlightedLine]
  )

  const { openDocName } = useEditorManagerContext()
  const isTexFile = useMemo(
    () => (openDocName ? isValidTeXFile(openDocName) : false),
    [openDocName]
  )

  const { _id: projectId } = useProjectContext()
  const storageKey = `file_outline.expanded.${projectId}`

  const [outlineExpanded, setOutlineExpanded] = useState(
    () => localStorage.getItem(storageKey) !== false
  )

  const canShowOutline = isTexFile && !binaryFileOpened

  const toggleOutlineExpanded = useCallback(() => {
    if (canShowOutline) {
      localStorage.setItem(storageKey, !outlineExpanded)
      eventTracking.sendMB(
        outlineExpanded ? 'outline-collapse' : 'outline-expand'
      )
      setOutlineExpanded(!outlineExpanded)
    }
  }, [canShowOutline, outlineExpanded, storageKey])

  const value = useMemo(
    () => ({
      flatOutline,
      setFlatOutline,
      highlightedLine,
      jumpToLine,
      canShowOutline,
      outlineExpanded,
      toggleOutlineExpanded,
    }),
    [
      flatOutline,
      highlightedLine,
      jumpToLine,
      canShowOutline,
      outlineExpanded,
      toggleOutlineExpanded,
    ]
  )

  return (
    <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>
  )
}

export const useOutlineContext = () => {
  const context = useContext(OutlineContext)

  if (!context) {
    throw new Error(
      'useOutlineProvider is only available inside OutlineProvider'
    )
  }

  return context
}

const closestSectionLineNumber = (
  outline: { line: number }[] | undefined,
  lineNumber: number
): number => {
  if (!outline) {
    return -1
  }
  let highestLine = -1
  for (const section of outline) {
    if (section.line > lineNumber) {
      return highestLine
    }
    highestLine = section.line
  }
  return highestLine
}
