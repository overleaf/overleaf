import { findInTreeOrThrow } from './find-in-tree'

export function renameInTree(tree, id, { newName }) {
  return mutateInTree(tree, id, (parent, entity, index) => {
    const newParent = Object.assign([], parent)
    const newEntity = {
      ...entity,
      name: newName,
    }
    newParent[index] = newEntity
    return newParent
  })
}

export function deleteInTree(tree, id) {
  return mutateInTree(tree, id, (parent, entity, index) => {
    return [...parent.slice(0, index), ...parent.slice(index + 1)]
  })
}

export function moveInTree(tree, entityId, toFolderId) {
  const found = findInTreeOrThrow(tree, entityId)
  if (found.parentFolderId === toFolderId) {
    // nothing to do (the entity was probably already moved)
    return tree
  }
  const newFileTreeData = deleteInTree(tree, entityId)
  return createEntityInTree(newFileTreeData, toFolderId, {
    ...found.entity,
    type: found.type,
  })
}

export function createEntityInTree(tree, parentFolderId, newEntityData) {
  const { type, ...newEntity } = newEntityData
  if (!type) throw new Error('Entity has no type')
  const entityType = `${type}s`

  return mutateInTree(tree, parentFolderId, (parent, folder, index) => {
    parent[index] = {
      ...folder,
      [entityType]: [...folder[entityType], newEntity],
    }
    return parent
  })
}

function mutateInTree(tree, id, mutationFunction) {
  if (!id || tree._id === id) {
    // covers the root folder case: it has no parent so in order to use
    // mutationFunction we pass an empty array as the parent and return the
    // mutated tree directly
    const [newTree] = mutationFunction([], tree, 0)
    return newTree
  }

  for (const entityType of ['docs', 'fileRefs', 'folders']) {
    for (let index = 0; index < tree[entityType].length; index++) {
      const entity = tree[entityType][index]
      if (entity._id === id) {
        return {
          ...tree,
          [entityType]: mutationFunction(tree[entityType], entity, index),
        }
      }
    }
  }

  const newFolders = tree.folders.map(folder =>
    mutateInTree(folder, id, mutationFunction)
  )

  return { ...tree, folders: newFolders }
}
