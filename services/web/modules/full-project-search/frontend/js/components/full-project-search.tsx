import React, { FC, lazy, Suspense } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const FullProjectSearchUI = lazy(() => import('./full-project-search-ui'))

const FullProjectSearch: FC = () => {
  const { projectSearchIsOpen } = useLayoutContext()
  const newEditor = useIsNewEditorEnabled()

  if (!projectSearchIsOpen && !newEditor) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <FullProjectSearchUI />
    </Suspense>
  )
}

export default FullProjectSearch
