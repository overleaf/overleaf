import { FC } from 'react'
import FileTreeContext from '@/features/file-tree/components/file-tree-context'

export const FileTreeProvider: FC<{
  refProviders?: Record<string, boolean>
}> = ({ children, refProviders = {} }) => {
  return (
    <FileTreeContext
      refProviders={refProviders}
      reindexReferences={cy.stub().as('reindexReferences')}
      setRefProviderEnabled={cy.stub().as('setRefProviderEnabled')}
      setStartedFreeTrial={cy.stub().as('setStartedFreeTrial')}
      onSelect={() => {}}
    >
      <>{children}</>
    </FileTreeContext>
  )
}
