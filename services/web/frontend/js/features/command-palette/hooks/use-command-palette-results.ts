import useDebounce from '@/shared/hooks/use-debounce'
import useCommandPaletteSources from './use-command-palette-sources'
import { useEffect, useState } from 'react'
import { CommandPaletteSearchResult, CommandPaletteSource } from '../types'

const useCommandPaletteResults = (query: string) => {
  const debouncedQuery = useDebounce(query, 25)
  const sources = useCommandPaletteSources()
  const [results, setResults] = useState<CommandPaletteSearchResult[]>([])

  useEffect(() => {
    const res = getSourcesMatchingQuery(debouncedQuery, sources).map(
      ({ source, query }) =>
        query ? source.search(query) : (source.defaults?.() ?? [])
    )
    setResults(res.flat().sort((a, b) => b.score - a.score))
  }, [debouncedQuery, sources])
  return results
}

const getSourcesMatchingQuery = (
  query: string,
  sources: CommandPaletteSource[]
): { query: string; source: CommandPaletteSource }[] => {
  // No query matches all sources
  if (!query) return sources.map(source => ({ source, query }))

  // If the query matches a prefix, return all the sources with that prefix
  const matchingSources = sources.filter(
    source => source.prefix && query.startsWith(source.prefix)
  )
  if (matchingSources.length > 0) {
    return matchingSources.map(source => ({
      source,
      query: query.slice(source.prefix!.length).trim(),
    }))
  }

  // otherwise return all sources that don't require a prefix match
  return sources
    .filter(source => !source.prefixRequired)
    .map(source => ({ source, query: query.trim() }))
}

export default useCommandPaletteResults
