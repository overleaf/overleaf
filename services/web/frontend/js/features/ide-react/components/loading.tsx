import { FC, useEffect, useState } from 'react'
import LoadingBranded from '../../../shared/components/loading-branded'
import i18n from '../../../i18n'
import { useConnectionContext } from '../context/connection-context'
import getMeta from '@/utils/meta'

type LoadStatus = 'initial' | 'rendered' | 'connected' | 'loaded'

const loadProgressPercentage: Record<LoadStatus, number> = {
  initial: 20,
  rendered: 40,
  connected: 70,
  loaded: 100,
}

// Pass in loading text from the server because i18n will not be ready initially
export const Loading: FC<{ loadingText: string }> = ({
  loadingText,
  children,
}) => {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('initial')
  const { connectionState, isConnected } = useConnectionContext()
  const loadProgress = loadProgressPercentage[loadStatus]
  const editorLoaded = loadStatus === 'loaded'

  const [i18nLoaded, setI18nLoaded] = useState(false)
  const [translationLoadError, setTranslationLoadError] = useState(false)

  // Advance to 40% once this component is rendered
  useEffect(() => {
    // Force a reflow now so that the animation from 20% to 40% occurs
    // eslint-disable-next-line no-void
    void document.body.offsetHeight
    setLoadStatus('rendered')
  }, [])

  useEffect(() => {
    i18n
      .then(() => setI18nLoaded(true))
      .catch(() => {
        setTranslationLoadError(true)
      })
  }, [])

  useEffect(() => {
    if (editorLoaded) {
      return
    }
    if (isConnected) {
      setLoadStatus(i18nLoaded ? 'loaded' : 'connected')
    }
  }, [i18nLoaded, editorLoaded, setLoadStatus, isConnected])

  const translationLoadErrorMessage = translationLoadError
    ? getMeta('ol-translationLoadErrorMessage')
    : ''

  return editorLoaded ? (
    <>{children}</>
  ) : (
    <div className="loading-screen">
      <LoadingBranded
        loadProgress={loadProgress}
        label={loadingText}
        error={connectionState.error || translationLoadErrorMessage}
      />
    </div>
  )
}
