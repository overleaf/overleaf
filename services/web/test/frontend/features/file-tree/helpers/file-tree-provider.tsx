import { ComponentProps, FC, useRef, useState } from 'react'
import FileTreeContext from '@/features/file-tree/components/file-tree-context'

export const FileTreeProvider: FC<
  React.PropsWithChildren<{
    refProviders?: Record<string, boolean>
  }>
> = ({ children, refProviders = {} }) => {
  const [fileTreeContainer, setFileTreeContainer] =
    useState<HTMLDivElement | null>(null)

  const propsRef =
    useRef<Omit<ComponentProps<typeof FileTreeContext>, 'refProviders'>>()

  if (propsRef.current === undefined) {
    propsRef.current = {
      setRefProviderEnabled: cy.stub().as('setRefProviderEnabled'),
      setStartedFreeTrial: cy.stub().as('setStartedFreeTrial'),
      onSelect: cy.stub(),
    }
  }

  return (
    <div ref={setFileTreeContainer}>
      {fileTreeContainer && (
        <FileTreeContext
          refProviders={refProviders}
          fileTreeContainer={fileTreeContainer}
          {...propsRef.current}
        >
          <>{children}</>
        </FileTreeContext>
      )}
    </div>
  )
}
