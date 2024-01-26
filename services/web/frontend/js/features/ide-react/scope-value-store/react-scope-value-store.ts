import { ScopeValueStore } from '../../../../../types/ide/scope-value-store'
import _ from 'lodash'
import customLocalStorage from '../../../infrastructure/local-storage'
import { debugConsole } from '@/utils/debugging'

const NOT_FOUND = Symbol('not found')

type Watcher<T> = {
  removed: boolean
  callback: (value: T) => void
}

// A value that has been set
type ScopeValueStoreValue<T = any> = {
  value?: T
  watchers: Watcher<T>[]
}

type WatcherUpdate<T = any> = {
  path: string
  value: T
  watchers: Watcher<T>[]
}

type NonExistentValue = {
  value: undefined
}

type AllowedNonExistentPath = {
  path: string
  deep: boolean
}

type Persister = {
  localStorageKey: string
  toPersisted?: (value: unknown) => unknown
}

function isObject(value: unknown): value is object {
  return (
    value !== null &&
    typeof value === 'object' &&
    !('length' in value && typeof value.length === 'number' && value.length > 0)
  )
}

function ancestorPaths(path: string) {
  const ancestors: string[] = []
  let currentPath = path
  let lastPathSeparatorPos: number
  while ((lastPathSeparatorPos = currentPath.lastIndexOf('.')) !== -1) {
    currentPath = currentPath.slice(0, lastPathSeparatorPos)
    ancestors.push(currentPath)
  }
  return ancestors
}

// Store scope values in a simple map
export class ReactScopeValueStore implements ScopeValueStore {
  private readonly items = new Map<string, ScopeValueStoreValue>()
  private readonly persisters: Map<string, Persister> = new Map()

  private watcherUpdates = new Map<string, WatcherUpdate>()
  private watcherUpdateTimer: number | null = null
  private allowedNonExistentPaths: AllowedNonExistentPath[] = []

  private nonExistentPathAllowed(path: string) {
    return this.allowedNonExistentPaths.some(allowedPath => {
      return (
        allowedPath.path === path ||
        (allowedPath.deep && path.startsWith(allowedPath.path + '.'))
      )
    })
  }

  // Create an item for a path. Attempt to get a value for the item from its
  // ancestors, if there are any.
  private findInAncestors(path: string): ScopeValueStoreValue {
    // Populate value from the nested property ancestors, if possible
    for (const ancestorPath of ancestorPaths(path)) {
      const ancestorItem = this.items.get(ancestorPath)
      if (
        ancestorItem &&
        'value' in ancestorItem &&
        isObject(ancestorItem.value)
      ) {
        const pathRelativeToAncestor = path.slice(ancestorPath.length + 1)
        const ancestorValue = _.get(ancestorItem.value, pathRelativeToAncestor)
        if (ancestorValue !== NOT_FOUND) {
          return { value: ancestorValue, watchers: [] }
        }
      }
    }
    return { watchers: [] }
  }

  private getItem<T>(path: string): ScopeValueStoreValue<T> | NonExistentValue {
    const item = this.items.get(path) || this.findInAncestors(path)
    if (!('value' in item)) {
      if (this.nonExistentPathAllowed(path)) {
        debugConsole.log(
          `No value found for key '${path}'. This is allowed because the path is in allowedNonExistentPaths`
        )
        return { value: undefined }
      } else {
        throw new Error(`No value found for key '${path}'`)
      }
    }
    return item
  }

  private reassembleObjectValue(path: string, value: Record<string, any>) {
    const newValue: Record<string, any> = { ...value }
    const pathPrefix = path + '.'
    for (const [key, item] of this.items.entries()) {
      if (key.startsWith(pathPrefix)) {
        const propName = key.slice(pathPrefix.length)
        if (propName.indexOf('.') === -1 && 'value' in item) {
          newValue[propName] = item.value
        }
      }
    }
    return newValue
  }

  flushUpdates() {
    if (this.watcherUpdateTimer) {
      window.clearTimeout(this.watcherUpdateTimer)
      this.watcherUpdateTimer = null
    }
    // Clone watcherUpdates in case a watcher creates new watcherUpdates
    const watcherUpdates = [...this.watcherUpdates.values()]
    this.watcherUpdates = new Map()
    for (const { value, watchers } of watcherUpdates) {
      for (const watcher of watchers) {
        if (!watcher.removed) {
          watcher.callback.call(null, value)
        }
      }
    }
  }

  private scheduleWatcherUpdate<T>(
    path: string,
    value: T,
    watchers: Watcher<T>[]
  ) {
    // Make a copy of the watchers so that any watcher added before this update
    // runs is not triggered
    const update: WatcherUpdate = {
      value,
      path,
      watchers: [...watchers],
    }
    this.watcherUpdates.set(path, update)
    if (!this.watcherUpdateTimer) {
      this.watcherUpdateTimer = window.setTimeout(() => {
        this.watcherUpdateTimer = null
        this.flushUpdates()
      }, 0)
    }
  }

  get<T>(path: string) {
    return this.getItem<T>(path).value
  }

  private setValue<T>(path: string, value: T): void {
    debugConsole.log('setValue', path, value)
    let item = this.items.get(path)
    if (item === undefined) {
      item = { value, watchers: [] }
      this.items.set(path, item)
    } else if (!('value' in item)) {
      item = { ...item, value }
      this.items.set(path, item)
    } else if (item.value === value) {
      // Don't update and trigger watchers if the value hasn't changed
      return
    } else {
      item.value = value
    }
    this.scheduleWatcherUpdate<T>(path, value, item.watchers)

    // Persist to local storage, if configured to do so
    const persister = this.persisters.get(path)
    if (persister) {
      customLocalStorage.setItem(
        persister.localStorageKey,
        persister.toPersisted?.(value) || value
      )
    }
  }

  private setValueAndDescendants<T>(path: string, value: T): void {
    this.setValue(path, value)

    // Set nested values non-recursively, only updating existing items
    if (isObject(value)) {
      const pathPrefix = path + '.'
      for (const [nestedPath, existingItem] of this.items.entries()) {
        if (nestedPath.startsWith(pathPrefix)) {
          const newValue = _.get(
            value,
            nestedPath.slice(pathPrefix.length),
            NOT_FOUND
          )
          // Only update a nested value if it has changed
          if (
            newValue !== NOT_FOUND &&
            (!('value' in existingItem) || newValue !== existingItem.value)
          ) {
            this.setValue(nestedPath, newValue)
          }
        }
      }

      // Delete nested items corresponding to properties that do not exist in
      // the new object
      const pathsToDelete: string[] = []
      const newPropNames = new Set(Object.keys(value))
      for (const path of this.items.keys()) {
        if (path.startsWith(pathPrefix)) {
          const propName = path.slice(pathPrefix.length).split('.', 1)[0]
          if (!newPropNames.has(propName)) {
            pathsToDelete.push(path)
          }
        }
      }
      for (const path of pathsToDelete) {
        this.items.delete(path)
      }
    }
  }

  set(path: string, value: unknown): void {
    this.setValueAndDescendants(path, value)

    // Reassemble ancestors. For example, if the path is x.y.z, x.y and x have
    // now changed too and must be updated
    for (const ancestorPath of ancestorPaths(path)) {
      const ancestorItem = this.items.get(ancestorPath)
      if (ancestorItem && 'value' in ancestorItem) {
        ancestorItem.value = this.reassembleObjectValue(
          ancestorPath,
          ancestorItem.value
        )
        this.scheduleWatcherUpdate(
          ancestorPath,
          ancestorItem.value,
          ancestorItem.watchers
        )
      }
    }
  }

  // Watch for changes in a scope value. The value does not need to exist yet.
  // Watchers are batched and called asynchronously to avoid chained state
  // watcherUpdates, which result in warnings from React (see
  // https://github.com/facebook/react/issues/18178)
  watch<T>(path: string, callback: Watcher<T>['callback']): () => void {
    let item = this.items.get(path)
    if (!item) {
      item = this.findInAncestors(path)
      this.items.set(path, item)
    }
    const watchers = item.watchers
    const watcher = { removed: false, callback }
    item.watchers.push(watcher)

    // Schedule watcher immediately. This is to work around the fact that there
    // is a delay between getting an initial value and adding a watcher in
    // useScopeValue, during which the value could change without being
    // observed
    if ('value' in item) {
      // add this watcher to any existing watchers scheduled for this path
      const { watchers } = this.watcherUpdates.get(path) ?? { watchers: [] }
      this.scheduleWatcherUpdate<T>(path, item.value, [...watchers, watcher])
    }

    return () => {
      // Add a flag to the watcher so that it can be ignored if the watcher is
      // removed in the interval between observing a change and being called
      watcher.removed = true
      _.pull(watchers, watcher)
    }
  }

  persisted<Value, PersistedValue>(
    path: string,
    fallbackValue: Value,
    localStorageKey: string,
    converter?: {
      toPersisted: (value: Value) => PersistedValue
      fromPersisted: (persisted: PersistedValue) => Value
    }
  ) {
    const persistedValue = customLocalStorage.getItem(
      localStorageKey
    ) as PersistedValue | null

    let value: Value = fallbackValue
    if (persistedValue !== null) {
      value = converter
        ? converter.fromPersisted(persistedValue)
        : (persistedValue as Value)
    }
    this.set(path, value)

    // Don't persist the value until set() is called
    this.persisters.set(path, {
      localStorageKey,
      toPersisted: converter?.toPersisted as Persister['toPersisted'],
    })
  }

  allowNonExistentPath(path: string, deep = false) {
    this.allowedNonExistentPaths.push({ path, deep })
  }

  // For debugging
  dump() {
    const entries = []
    for (const [path, item] of this.items.entries()) {
      entries.push({
        path,
        value: 'value' in item ? item.value : '[not set]',
        watcherCount: item.watchers.length,
      })
    }
    return entries
  }
}
