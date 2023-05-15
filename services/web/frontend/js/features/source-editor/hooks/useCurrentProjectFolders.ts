import { useMemo } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { File, FileOrDirectory, filterFolders } from '../utils/file'

export const useCurrentProjectFolders: () => [
  File[] | undefined,
  File
] = () => {
  const [rootFolder] = useScopeValue<FileOrDirectory>('rootFolder')
  const rootFile = { ...rootFolder, path: '' }
  const folders = useMemo(() => filterFolders(rootFolder), [rootFolder])
  return [folders, rootFile]
}
