import { useMemo } from 'react'
import { CommandPaletteSource } from '../types'
import useCommandRegistrySource from './use-command-registry-source'
import useFileTreeCommandSource from './use-file-tree-command-source'
import { useJumpToLineCommandSource } from './use-jump-to-line-command-source'

const useCommandPaletteSources = (): CommandPaletteSource[] => {
  const fileTreeSource = useFileTreeCommandSource()
  const commandRegistrySource = useCommandRegistrySource()
  const jumpToLineSource = useJumpToLineCommandSource()

  const sources = useMemo(
    () => [fileTreeSource, commandRegistrySource, jumpToLineSource],
    [fileTreeSource, commandRegistrySource, jumpToLineSource]
  )
  return sources
}

export default useCommandPaletteSources
