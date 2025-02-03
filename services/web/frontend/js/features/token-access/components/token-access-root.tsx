import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import { ElementType, useCallback, useEffect, useRef, useState } from 'react'
import getMeta from '@/utils/meta'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { useLocation } from '@/shared/hooks/use-location'
import { AccessAttemptScreen } from '@/features/token-access/components/access-attempt-screen'
import {
  RequireAcceptData,
  RequireAcceptScreen,
} from '@/features/token-access/components/require-accept-screen'
import Icon from '@/shared/components/icon'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

type Mode = 'access-attempt' | 'v1Import' | 'requireAccept'

const [v1ImportDataScreenModule] = importOverleafModules(
  'v1ImportDataScreen'
) as {
  import: { default: ElementType }
}[]
const V1ImportDataScreen = v1ImportDataScreenModule?.import.default

export type V1ImportData = {
  name?: string
  status: string
  projectId: string
}

function TokenAccessRoot() {
  const [mode, setMode] = useState<Mode>('access-attempt')
  const [inflight, setInflight] = useState(false)
  const [accessError, setAccessError] = useState<string | boolean>(false)
  const [v1ImportData, setV1ImportData] = useState<V1ImportData>()
  const [requireAcceptData, setRequireAcceptData] =
    useState<RequireAcceptData>()
  const [loadingScreenBrandHeight, setLoadingScreenBrandHeight] =
    useState('0px')
  const location = useLocation()

  const sendPostRequest = useCallback(
    (confirmedByUser = false) => {
      setInflight(true)

      postJSON(getMeta('ol-postUrl'), {
        body: {
          confirmedByUser,
          tokenHashPrefix: document.location.hash,
        },
      })
        .then(async data => {
          setAccessError(false)

          if (data.redirect) {
            location.replace(data.redirect)
          } else if (data.v1Import) {
            setMode('v1Import')
            setV1ImportData(data.v1Import)
          } else if (data.requireAccept) {
            setMode('requireAccept')
            setRequireAcceptData(data.requireAccept)
          } else {
            debugConsole.warn(
              'invalid data from server in success response',
              data
            )
            setAccessError(true)
          }
        })
        .catch(error => {
          debugConsole.warn('error response from server', error)
          setAccessError(error.response?.status === 404 ? 'not_found' : 'error')
        })
        .finally(() => {
          setInflight(false)
        })
    },
    [location]
  )

  const postedRef = useRef(false)
  useEffect(() => {
    if (!postedRef.current) {
      postedRef.current = true
      sendPostRequest()
      setTimeout(() => {
        setLoadingScreenBrandHeight('20%')
      }, 500)
    }
  }, [sendPostRequest])

  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  // We don't want the full-size div and back link(?) on
  // the new page, but we do this so the original page
  // doesn't change.
  // TODO: clean up the DOM in the main return
  if (mode === 'requireAccept' && requireAcceptData) {
    return (
      <RequireAcceptScreen
        requireAcceptData={requireAcceptData}
        sendPostRequest={sendPostRequest}
      />
    )
  }

  return (
    <div className="full-size">
      <div>
        <a
          href="/project"
          // TODO: class name
          style={{ fontSize: '2rem', marginLeft: '1rem', color: '#ddd' }}
        >
          <Icon type="arrow-left" />
        </a>
      </div>

      {mode === 'access-attempt' && (
        <AccessAttemptScreen
          accessError={accessError}
          inflight={inflight}
          loadingScreenBrandHeight={loadingScreenBrandHeight}
        />
      )}

      {V1ImportDataScreen && mode === 'v1Import' && v1ImportData && (
        <V1ImportDataScreen v1ImportData={v1ImportData} />
      )}
    </div>
  )
}

export default withErrorBoundary(TokenAccessRoot, GenericErrorBoundaryFallback)
