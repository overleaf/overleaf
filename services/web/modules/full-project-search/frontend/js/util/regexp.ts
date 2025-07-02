import { SearchQuery } from '@codemirror/search'

export const createRegExp = (searchQuery: SearchQuery) => {
  const flags = 'gmu' + (searchQuery.caseSensitive ? '' : 'i')

  return new RegExp(searchQuery.search, flags)
}
