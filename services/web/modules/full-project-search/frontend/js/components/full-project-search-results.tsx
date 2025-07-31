import React, { FC, useCallback, useEffect, useRef, useState } from 'react'
import { Hit, MatchedFile } from '../util/search-snapshot'
import classnames from 'classnames'
import { CollapsibleFileHeader } from '@/shared/components/collapsible-file-header'
import { MatchedHit } from './matched-hit'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { sendSearchEvent } from '@/features/event-tracking/search-events'

export const FullProjectSearchResults: FC<{
  matchedFiles: MatchedFile[]
  currentDocPath: string | null
}> = ({ matchedFiles, currentDocPath }) => {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [selectedHit, setSelectedHit] = useState<Hit>()

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedFiles(value => {
      const newValue = new Set(value)
      if (newValue.has(path)) {
        newValue.delete(path)
      } else {
        newValue.add(path)
      }
      return newValue
    })
  }, [])

  const resultsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = resultsContainerRef.current
    if (container) {
      const hits = matchedFiles.flatMap(file => file.hits)

      const findSelectedHitIndex = () =>
        hits.findIndex(hit => hit === selectedHit)

      const listener = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
          return
        }

        if (!matchedFiles) {
          return
        }

        switch (event.key) {
          case 'Enter':
          case ' ': // Space
            window.setTimeout(() => {
              window.dispatchEvent(new Event('editor:focus'))
            })
            break

          case 'ArrowUp':
            {
              event.preventDefault()
              let index = findSelectedHitIndex()
              if (index === 0) {
                index = hits.length
              }
              index--
              if (index < 0) {
                index = 0
              }
              setSelectedHit(hits[index])
            }
            break

          case 'ArrowDown':
            {
              event.preventDefault()
              let index = findSelectedHitIndex()
              index++
              if (index >= hits.length) {
                index = 0
              }
              setSelectedHit(hits[index])
            }
            break
        }
      }

      container.addEventListener('keydown', listener)

      return () => {
        container.removeEventListener('keydown', listener)
      }
    }
  }, [matchedFiles, selectedHit, setSelectedHit])

  const { findEntityByPath } = useFileTreePathContext()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()

  const selectedHitRef = useRef<Hit>()

  useEffect(() => {
    // only open the doc if selectedHit has actually changed
    if (selectedHit && selectedHit !== selectedHitRef.current) {
      selectedHitRef.current = selectedHit
      const selectedFile = matchedFiles.find(file =>
        file.hits.includes(selectedHit)
      )
      if (selectedFile) {
        const result = findEntityByPath(selectedFile.path)
        if (result) {
          sendSearchEvent('search-result-click', {
            searchType: 'full-project',
          })
          const line = selectedHit.lineIndex
          const column = selectedHit.matchIndex
          const text = selectedFile.lines[line].substring(
            column,
            column + selectedHit.length
          )
          if (result.type === 'doc') {
            openDocWithId(result.entity._id, {
              gotoLine: line + 1,
              gotoColumn: column,
              selectText: text,
            })
          } else if (result.type === 'fileRef') {
            openFileWithId(result.entity._id)
          }
        }
      }
    }
  }, [
    findEntityByPath,
    matchedFiles,
    openDocWithId,
    openFileWithId,
    selectedHit,
  ])

  const tabbableHit = selectedHit ?? matchedFiles?.[0]?.hits[0]

  return (
    <div className="matched-files" ref={resultsContainerRef}>
      {matchedFiles.map(matchedFile => (
        <div
          key={matchedFile.path}
          className={classnames('matched-file', {
            'matched-file-open': currentDocPath === matchedFile.path,
          })}
        >
          <CollapsibleFileHeader
            name={matchedFile.path}
            count={matchedFile.hits.length}
            collapsed={collapsedFiles.has(matchedFile.path)}
            toggleCollapsed={() => toggleCollapse(matchedFile.path)}
          />
          {!collapsedFiles.has(matchedFile.path) && (
            <div className="list-group matched-file-hits" role="listbox">
              {matchedFile.hits.map(hit => {
                return (
                  <MatchedHit
                    key={`${hit.lineIndex}:${hit.matchIndex}`}
                    matchedFile={matchedFile}
                    hit={hit}
                    selected={hit === selectedHit}
                    setSelectedHit={setSelectedHit}
                    tabIndex={tabbableHit === hit ? 0 : -1}
                  />
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
