import { useMemo } from 'react'
import { CommandPaletteSource } from '../types'
import useCommandRegistrySource from './use-command-registry-source'
import useFileTreeCommandSource from './use-file-tree-command-source'

const useCommandPaletteSources = (): CommandPaletteSource[] => {
  const fileTreeSource = useFileTreeCommandSource()
  const commandRegistrySource = useCommandRegistrySource()
  const sources = useMemo(
    () => [fileTreeSource, commandRegistrySource],
    [fileTreeSource, commandRegistrySource]
  )
  return sources
}

export default useCommandPaletteSources
