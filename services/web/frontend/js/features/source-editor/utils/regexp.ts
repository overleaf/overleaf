import { SearchQuery } from '@codemirror/search'

export const createRegExp = (searchQuery: SearchQuery) => {
  const flags = 'gmu' + (searchQuery.caseSensitive ? '' : 'i')

  return new RegExp(searchQuery.search, flags)
}

export const isInvalidRegExp = (searchQuery: SearchQuery): boolean => {
  try {
    createRegExp(searchQuery)
    return false
  } catch {
    return true
  }
}
