import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-bootstrap'
import { RecurlyError, TokenPayload } from 'recurly__recurly-js'

type ThreeDSecureProps = {
  actionTokenId: string
  onToken: (token: TokenPayload) => void
  onError: (error: RecurlyError) => void
}

function ThreeDSecure({ actionTokenId, onToken, onError }: ThreeDSecureProps) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const recurlyContainer = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // scroll the UI into view (timeout needed to make sure the element is
    // visible)
    const timeout = setTimeout(() => {
      container.current?.scrollIntoView()
    }, 0)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (!recurly || !recurlyContainer.current) return

    // instanciate and configure Recurly 3DSecure flow
    const risk = recurly.Risk()
    const threeDSecure = risk.ThreeDSecure({ actionTokenId })

    threeDSecure.on('token', onToken)
    threeDSecure.on('error', onError)
    threeDSecure.attach(recurlyContainer.current)

    return () => {
      recurlyContainer.current = null
    }
  }, [actionTokenId, onToken, onError])

  return (
    <div className="three-d-secure-container--react" ref={container}>
      <Alert bsStyle="info" className="small" aria-live="assertive">
        <strong>{t('card_must_be_authenticated_by_3dsecure')}</strong>
      </Alert>
      <div
        className="three-d-secure-recurly-container"
        ref={recurlyContainer}
      />
    </div>
  )
}

export default ThreeDSecure
