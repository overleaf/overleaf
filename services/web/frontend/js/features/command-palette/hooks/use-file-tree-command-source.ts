import { useCallback, useMemo } from 'react'
import { CommandPaletteSearchResult, CommandPaletteSource } from '../types'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Folder } from '@ol-types/folder'
import MiniSearch from 'minisearch'
import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { debugConsole } from '@/utils/debugging'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'

type FlatFileTree = { path: string; name: string; id: string }[]

const FILE_POSITION_REGEX = /:(\d+)(?:,(\d+))?$/

const useFileTreeCommandSource = (): CommandPaletteSource => {
  const { fileTreeData } = useFileTreeData()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()
  const networkStalled = useIsNetworkStalled()

  const flatFileTree = useMemo(
    () => flattenFileTree(fileTreeData),
    [fileTreeData]
  )
  const index = useMemo(
    () => flatFileTree && indexFromFlatFileTree(flatFileTree),
    [flatFileTree]
  )

  const onSelect = useCallback(
    async (
      id: string,
      line: number | undefined,
      column: number | undefined
    ) => {
      if (!fileTreeData) {
        return
      }
      const file = findInTree(fileTreeData, id)
      if (!file) {
        return
      }
      if (file.type === 'doc') {
        await openDocWithId(file.entity._id, {
          gotoLine: line,
          gotoColumn: column,
        })
      } else if (file.type === 'fileRef') {
        openFileWithId(file.entity._id)
      } else {
        debugConsole.error('Attempting to open invalid entity type')
      }
    },
    [fileTreeData, openDocWithId, openFileWithId]
  )

  const defaults = useCallback((): CommandPaletteSearchResult[] => {
    if (networkStalled) {
      return []
    }
    if (!flatFileTree) {
      return []
    }
    const files: CommandPaletteSearchResult[] = flatFileTree
      .slice(0, 10)
      .map(({ path, name, id }) => ({
        title: name,
        description:
          path === name ? undefined : path.split('/').slice(0, -1).join('/'),
        onSelect: () => onSelect(id, undefined, undefined),
        score: 1,
        eventSegmentation: { source: 'file' },
      }))

    return files
  }, [flatFileTree, onSelect, networkStalled])

  const source: CommandPaletteSource = useMemo(
    () => ({
      id: 'file-tree',
      search(query) {
        if (networkStalled) {
          return []
        }
        if (!index) {
          return []
        }
        const fileLocationMatch = query.match(FILE_POSITION_REGEX)
        let line: number | undefined = undefined
        let column: number | undefined = undefined
        if (fileLocationMatch) {
          line = parseInt(fileLocationMatch[1], 10)
          column = fileLocationMatch[2]
            ? parseInt(fileLocationMatch[2], 10)
            : undefined
          query = query.slice(0, fileLocationMatch.index)
        }

        const result = index.search(query, {
          prefix: true,
          fuzzy: term => (term.length > 3 ? 0.2 : false),
        })

        return result.map(({ path, name, id, score }) => ({
          title: name,
          description:
            path === name ? undefined : path.split('/').slice(0, -1).join('/'),
          onSelect: () => onSelect(id, line, column),
          score,
          eventSegmentation: { source: 'file' },
        }))
      },
      defaults,
    }),
    [index, onSelect, defaults, networkStalled]
  )
  return source
}

export default useFileTreeCommandSource

const flattenFileTree = (
  folder: Folder,
  parentPath = ''
): FlatFileTree | null => {
  if (!folder) {
    return null
  }
  const currentPath = `${parentPath}/${folder.name}`
  const files = folder.fileRefs.map(file => ({
    path: `${currentPath}/${file.name}`.replace(/^\/rootFolder\//, ''),
    name: file.name,
    id: file._id,
  }))

  const docs = folder.docs.map(doc => ({
    path: `${currentPath}/${doc.name}`.replace(/^\/rootFolder\//, ''),
    name: doc.name,
    id: doc._id,
  }))

  const subFolders = folder.folders
    .flatMap(subFolder => flattenFileTree(subFolder, currentPath))
    .filter(x => x !== null)

  return [...docs, ...files, ...subFolders]
}

function indexFromFlatFileTree(flatFileTree: FlatFileTree): MiniSearch {
  const miniSearch = new MiniSearch({
    fields: ['path', 'name'],
    storeFields: ['path', 'name'],
  })

  if (!flatFileTree) {
    return miniSearch
  }

  miniSearch.addAll(flatFileTree)

  return miniSearch
}
