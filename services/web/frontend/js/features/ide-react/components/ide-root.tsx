import { FC, memo, useState } from 'react'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'
import IdePage from '@/features/ide-react/components/layout/ide-page'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import { Loading } from '@/features/ide-react/components/loading'

const IdeRoot: FC = () => {
  const [loaded, setLoaded] = useState(false)

  return (
    <ReactContextRoot>
      {loaded ? <IdePage /> : <Loading setLoaded={setLoaded} />}
    </ReactContextRoot>
  )
}

export default withErrorBoundary(memo(IdeRoot), () => (
  <GenericErrorBoundaryFallback />
))
