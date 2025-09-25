import { FC, useEffect, useMemo, useState } from 'react'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { WordCountError } from '@/features/word-count-modal/components/word-count-error'
import { useProjectContext } from '@/shared/context/project-context'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { debugConsole } from '@/utils/debugging'
import { signalWithTimeout } from '@/utils/abort-signal'
import { isMainFile } from '@/features/pdf-preview/util/editor-files'
import { countWordsInFile } from '@/features/word-count-modal/utils/count-words-in-file'
import { createSegmenters } from '@/features/word-count-modal/utils/segmenters'
import { WordCountsClient } from './word-counts-client'
import LoadingSpinner from '@/shared/components/loading-spinner'

export const WordCountClient: FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<WordCountData | null>(null)
  const { projectSnapshot, project } = useProjectContext()
  const rootDocId = project?.rootDocId
  const { spellCheckLanguage } = useProjectSettingsContext()
  const { openDocs } = useEditorManagerContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { pathInFolder } = useFileTreePathContext()

  const { signal } = useAbortController()

  const segmenters = useMemo(() => {
    return createSegmenters(spellCheckLanguage?.replace(/_/, '-'))
  }, [spellCheckLanguage])

  useEffect(() => {
    if (currentDocument && segmenters) {
      const countWords = async () => {
        await openDocs.awaitBufferedOps(signalWithTimeout(signal, 5000))
        await projectSnapshot.refresh()

        if (signal.aborted) return null

        const currentDocSnapshot = currentDocument.getSnapshot()
        const currentRootDocId = isMainFile(currentDocSnapshot)
          ? currentDocument.doc_id
          : rootDocId
        if (!currentRootDocId) return null

        const currentRootDocPath = pathInFolder(currentRootDocId)
        if (!currentRootDocPath) return null

        const data: WordCountData = {
          encode: 'ascii',
          textWords: 0,
          textCharacters: 0,
          headWords: 0,
          headCharacters: 0,
          abstractWords: 0,
          abstractCharacters: 0,
          captionWords: 0,
          captionCharacters: 0,
          footnoteWords: 0,
          footnoteCharacters: 0,
          outside: 0,
          otherWords: 0,
          otherCharacters: 0,
          headers: 0,
          elements: 0,
          mathInline: 0,
          mathDisplay: 0,
          errors: 0,
          messages: '',
        }

        countWordsInFile(
          data,
          projectSnapshot,
          currentRootDocPath,
          '/',
          segmenters
        )

        return data
      }

      countWords()
        .then(data => {
          setData(data)
        })
        .catch(error => {
          debugConsole.error(error)
          setError(true)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [
    signal,
    openDocs,
    projectSnapshot,
    segmenters,
    currentDocument,
    rootDocId,
    pathInFolder,
  ])

  return (
    <>
      {loading && !error && <LoadingSpinner />}
      {error && <WordCountError />}
      {data && <WordCountsClient data={data} />}
    </>
  )
}
