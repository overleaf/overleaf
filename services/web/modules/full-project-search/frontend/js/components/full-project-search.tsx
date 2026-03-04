import React, { FC, lazy, Suspense } from 'react'

const FullProjectSearchUI = lazy(() => import('./full-project-search-ui'))

const FullProjectSearch: FC = () => {
  return (
    <Suspense fallback={null}>
      <FullProjectSearchUI />
    </Suspense>
  )
}

export default FullProjectSearch
