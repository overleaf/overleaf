import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { Folder } from '@ol-types/folder'
import { FileTreeFindResult } from '../types/file-tree'
type Id = string

type PartialTabInfo = {
  id: Id
  name: string
  path: Id[]
  depth: number
}

const lookupNameInTreeWithCache = (
  fileTree: Folder,
  id: Id,
  cache: Map<Id, string>
) => {
  if (id === fileTree._id) return '' // Special case for root

  // Check cache first to avoid expensive tree traversal on every call
  const cached = cache.get(id)
  if (cached !== undefined) {
    return cached
  }

  // Finally look it up if we haven't already seen the id
  const result = findInTree(fileTree, id)
  const name = result?.entity.name ?? ''
  cache.set(id, name)
  return name
}

function getDisplayPath(
  tab: PartialTabInfo,
  fileTree: Folder,
  cache: Map<Id, string>
): string {
  return (
    tab.path
      // filter out the first part of the path (root folder)
      .slice(Math.max(tab.path.length - tab.depth, 1), tab.path.length)
      .map(parentFolderId =>
        lookupNameInTreeWithCache(fileTree, parentFolderId, cache)
      )
      .concat(tab.name)
      .join('/')
  )
}

export const disambiguatePaths = (
  tabs: FileTreeFindResult[],
  fileTree: Folder
): Map<Id, string> => {
  const cache = new Map<Id, string>()
  const results = new Map<Id, string>()

  const tabsWithPartialPaths: PartialTabInfo[] = tabs.map(tab => ({
    id: tab.entity._id,
    name: tab.entity.name,
    path: tab.path,
    depth: 0,
  }))

  while (true) {
    const collisionMap = new Map<string, PartialTabInfo[]>()
    for (const tab of tabsWithPartialPaths) {
      // already resolved
      if (results.has(tab.id)) {
        continue
      }
      const displayPath = getDisplayPath(tab, fileTree, cache)
      if (!collisionMap.has(displayPath)) {
        collisionMap.set(displayPath, [])
      }
      collisionMap.get(displayPath)!.push(tab)
    }

    let hasCollisions = false
    for (const [displayPath, collidingTabs] of collisionMap.entries()) {
      if (collidingTabs.length === 1) {
        const tab = collidingTabs[0]
        results.set(tab.id, displayPath)
      } else {
        for (const tab of collidingTabs) {
          if (tab.depth < tab.path.length - 1) {
            // This tab is still colliding, but we can reveal more of the path
            // (minus root folder) to try to disambiguate it
            tab.depth++
            hasCollisions = true
          } else {
            // We've already revealed the entire path and they're still
            // colliding, so we'll just have to use the name
            results.set(tab.id, tab.name)
          }
        }
      }
    }
    if (!hasCollisions) {
      break
    }
  }

  return results
}
