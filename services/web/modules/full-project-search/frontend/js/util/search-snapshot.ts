import { Text } from '@codemirror/state'
import { RegExpCursor, SearchCursor, SearchQuery } from '@codemirror/search'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { categorizer, regexpWordTest, stringWordTest } from './search'
import { sendSearchEvent } from '@/features/event-tracking/search-events'
import { populateEditorRedesignSegmentation } from '@/shared/hooks/use-editor-analytics'

export type Hit = {
  lineIndex: number
  matchIndex: number
  length: number
}

export type MatchedFile = {
  path: string
  lines: string[]
  hits: Hit[]
}

const toLowerCase = (string: string) => string.toLowerCase()

export const searchSnapshot = async (
  projectSnapshot: ProjectSnapshot,
  searchQuery: SearchQuery,
  newEditor: boolean
) => {
  if (!searchQuery.search.trim().length) {
    return
  }

  const matchedFiles = new Map<string, MatchedFile>()

  const createCursor = (text: Text) => {
    if (searchQuery.regexp) {
      return new RegExpCursor(text, searchQuery.search, {
        ignoreCase: !searchQuery.caseSensitive,
        test: searchQuery.wholeWord ? regexpWordTest(categorizer) : undefined,
      })
    }

    return new SearchCursor(
      text,
      searchQuery.search,
      undefined,
      undefined,
      searchQuery.caseSensitive ? undefined : toLowerCase,
      searchQuery.wholeWord ? stringWordTest(text, categorizer) : undefined
    )
  }

  const docPaths = projectSnapshot.getDocPaths()

  for (const path of docPaths) {
    const content = projectSnapshot.getDocContents(path)
    if (content) {
      const lines = content.split('\n')
      const text = Text.of(lines)

      const cursor = createCursor(text)

      while (!cursor.next().done) {
        const { from, to } = cursor.value

        const matchedFile: MatchedFile = matchedFiles.get(path) ?? {
          path,
          lines,
          hits: [],
        }

        const line = text.lineAt(from)

        matchedFile.hits.push({
          lineIndex: line.number - 1,
          matchIndex: from - line.from,
          length: to - from,
        })

        matchedFiles.set(path, matchedFile)
      }
    }
  }

  const results = [...matchedFiles.values()].sort((a, b) =>
    a.path.localeCompare(b.path)
  )

  sendSearchEvent(
    'search-execute',
    populateEditorRedesignSegmentation(
      {
        searchType: 'full-project',
        totalDocs: docPaths.length,
        totalResults: results.flatMap(file => file.hits).length,
      },
      newEditor
    )
  )

  return results
}
