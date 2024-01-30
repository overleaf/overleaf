import { ComponentProps, FC, useRef } from 'react'
import FileTreeContext from '@/features/file-tree/components/file-tree-context'

export const FileTreeProvider: FC<{
  refProviders?: Record<string, boolean>
}> = ({ children, refProviders = {} }) => {
  const propsRef =
    useRef<Omit<ComponentProps<typeof FileTreeContext>, 'refProviders'>>()

  if (propsRef.current === undefined) {
    propsRef.current = {
      reindexReferences: cy.stub().as('reindexReferences'),
      setRefProviderEnabled: cy.stub().as('setRefProviderEnabled'),
      setStartedFreeTrial: cy.stub().as('setStartedFreeTrial'),
      onSelect: cy.stub(),
    }
  }

  return (
    <FileTreeContext refProviders={refProviders} {...propsRef.current}>
      <>{children}</>
    </FileTreeContext>
  )
}
