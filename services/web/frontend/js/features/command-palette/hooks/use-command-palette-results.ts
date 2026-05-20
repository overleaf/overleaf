import useDebounce from '@/shared/hooks/use-debounce'
import useCommandPaletteSources from './use-command-palette-sources'
import { useEffect, useState } from 'react'
import { CommandPaletteSearchResult } from '../types'

const useCommandPaletteResults = (query: string) => {
  const debouncedQuery = useDebounce(query, 25)
  const sources = useCommandPaletteSources()
  const [results, setResults] = useState<CommandPaletteSearchResult[]>([])

  useEffect(() => {
    if (debouncedQuery) {
      const res = sources.map(source => source.search(debouncedQuery))
      setResults(res.flat().sort((a, b) => b.score - a.score))
    } else {
      const res = sources
        .filter(s => 'defaults' in s)
        .map(source => source.defaults!())
      setResults(res.flat().sort((a, b) => b.score - a.score))
    }
  }, [debouncedQuery, sources])
  return results
}

export default useCommandPaletteResults
