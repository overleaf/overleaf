import {
  findInTree,
  findInTreeOrThrow,
} from '@/features/file-tree/util/find-in-tree'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import useNestedOutline from '@/features/outline/hooks/use-nested-outline'
import getChildrenLines from '@/features/outline/util/get-children-lines'
import MaterialIcon from '@/shared/components/material-icon'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Fragment, useMemo } from 'react'
import { Outline } from '@/features/source-editor/utils/tree-operations/outline'

const constructOutlineHierarchy = (
  items: Outline[],
  highlightedLine: number,
  outlineHierarchy: Outline[] = []
) => {
  for (const item of items) {
    if (item.line === highlightedLine) {
      outlineHierarchy.push(item)
      return outlineHierarchy
    }

    const childLines = getChildrenLines(item.children)
    if (childLines.includes(highlightedLine)) {
      outlineHierarchy.push(item)
      return constructOutlineHierarchy(
        item.children as Outline[],
        highlightedLine,
        outlineHierarchy
      )
    }
  }
  return outlineHierarchy
}

export default function Breadcrumbs() {
  const { openEntity } = useFileTreeOpenContext()
  const { fileTreeData } = useFileTreeData()
  const outline = useNestedOutline()
  const { highlightedLine, canShowOutline } = useOutlineContext()

  const folderHierarchy = useMemo(() => {
    if (openEntity?.type !== 'doc' || !fileTreeData) {
      return []
    }

    try {
      return openEntity.path
        .filter(id => id !== fileTreeData._id) // Filter out the root folder
        .map(id => {
          return findInTreeOrThrow(fileTreeData, id)?.entity
        })
    } catch {
      // If any of the folders in the path are not found, the entire hierarchy
      // is invalid.
      return []
    }
  }, [openEntity, fileTreeData])

  const fileName = useMemo(() => {
    // NOTE: openEntity.entity.name may not always be accurate, so we read it
    // from the file tree data instead.
    if (openEntity?.type !== 'doc' || !fileTreeData) {
      return undefined
    }
    return findInTree(fileTreeData, openEntity.entity._id)?.entity.name
  }, [fileTreeData, openEntity])

  const outlineHierarchy = useMemo(() => {
    if (openEntity?.type !== 'doc' || !canShowOutline || !outline) {
      return []
    }

    return constructOutlineHierarchy(outline.items, highlightedLine)
  }, [outline, highlightedLine, canShowOutline, openEntity])

  if (openEntity?.type !== 'doc' || !fileTreeData) {
    return null
  }

  const numOutlineItems = outlineHierarchy.length

  return (
    <div className="ol-cm-breadcrumbs" translate="no">
      {folderHierarchy.map(folder => (
        <Fragment key={folder._id}>
          <div>{folder.name}</div>
          <Chevron />
        </Fragment>
      ))}
      <MaterialIcon unfilled type="description" />
      <div>{fileName}</div>
      {numOutlineItems > 0 && <Chevron />}
      {outlineHierarchy.map((section, idx) => (
        <Fragment key={section.line}>
          <div>{section.title}</div>
          {idx < numOutlineItems - 1 && <Chevron />}
        </Fragment>
      ))}
    </div>
  )
}

const Chevron = () => (
  <MaterialIcon className="ol-cm-breadcrumb-chevron" type="chevron_right" />
)
