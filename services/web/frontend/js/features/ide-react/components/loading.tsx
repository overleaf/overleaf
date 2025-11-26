import { FC, useEffect, useState, useCallback } from 'react'
import LoadingBranded from '@/shared/components/loading-branded'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import { useConnectionContext } from '../context/connection-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { LoadingError, LoadingErrorProps } from './loading-error'
import classNames from 'classnames'

type Part = 'initial' | 'render' | 'connection' | 'translations' | 'project'

const initialParts = new Set<Part>(['initial'])

const totalParts = new Set<Part>([
  'initial',
  'render',
  'connection',
  'translations',
  'project',
])

// Minimum time to show the loading screen for a polished feel
const MIN_DISPLAY_TIME = 800 // ms

export const Loading: FC<{
  setLoaded: (value: boolean) => void
}> = ({ setLoaded }) => {
  const [loadedParts, setLoadedParts] = useState(initialParts)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [startTime] = useState(Date.now())

  const progress = (loadedParts.size / totalParts.size) * 100
  const isComplete = progress === 100

  const triggerFadeOut = useCallback(() => {
    const elapsed = Date.now() - startTime
    const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsed)

    // Wait for minimum display time, then fade out
    setTimeout(() => {
      setIsFadingOut(true)
      // After fade animation completes, signal loaded
      setTimeout(() => {
        setLoaded(true)
      }, 400) // Match CSS transition duration
    }, remainingTime)
  }, [setLoaded, startTime])

  useEffect(() => {
    if (isComplete) {
      triggerFadeOut()
    }
  }, [isComplete, triggerFadeOut])

  const { connectionState, isConnected } = useConnectionContext()
  const i18n = useWaitForI18n()
  const { projectJoined } = useIdeReactContext()

  useEffect(() => {
    setLoadedParts(value => new Set(value).add('render'))
  }, [])

  useEffect(() => {
    if (isConnected) {
      setLoadedParts(value => new Set(value).add('connection'))
    }
  }, [isConnected])

  useEffect(() => {
    if (i18n.isReady) {
      setLoadedParts(value => new Set(value).add('translations'))
    }
  }, [i18n.isReady])

  useEffect(() => {
    if (projectJoined) {
      setLoadedParts(value => new Set(value).add('project'))
    }
  }, [projectJoined])

  // Use loading text from the server, because i18n will not be ready initially
  const label = getMeta('ol-loadingText')

  const errorCode = connectionState.error ?? (i18n.error ? 'i18n-error' : '')

  return (
    <LoadingUI
      progress={progress}
      label={label}
      errorCode={errorCode}
      isFadingOut={isFadingOut}
    />
  )
}

type LoadingUiProps = {
  progress: number
  label: string
  errorCode: LoadingErrorProps['errorCode']
  isFadingOut?: boolean
}

export const LoadingUI: FC<LoadingUiProps> = ({
  progress,
  label,
  errorCode,
  isFadingOut = false,
}) => {
  return (
    <div
      className={classNames('loading-screen', {
        'fade-out': isFadingOut,
      })}
    >
      <LoadingBranded
        loadProgress={progress}
        label={label}
        hasError={Boolean(errorCode)}
      />
      {Boolean(errorCode) && <LoadingError errorCode={errorCode} />}
    </div>
  )
}
