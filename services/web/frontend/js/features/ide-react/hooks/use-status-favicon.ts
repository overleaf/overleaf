import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useEffect, useState } from 'react'
import usePreviousValue from '@/shared/hooks/use-previous-value'
import getMeta from '@/utils/meta'

const RESET_AFTER_MS = 5_000

const COMPILE_ICONS = {
  ERROR: 'favicon-error.svg',
  COMPILING: 'favicon-compiling.svg',
  COMPILED: 'favicon-compiled.svg',
  UNCOMPILED: 'favicon.svg',
} as const

type CompileStatus = keyof typeof COMPILE_ICONS

const useCompileStatus = (): CompileStatus => {
  const compileContext = useCompileContext()
  if (compileContext.uncompiled) return 'UNCOMPILED'
  if (compileContext.compiling) return 'COMPILING'
  if (compileContext.error) return 'ERROR'
  return 'COMPILED'
}

const removeFavicon = () => {
  const existingFavicons = document.head.querySelectorAll(
    "link[rel='icon']"
  ) as NodeListOf<HTMLLinkElement>
  existingFavicons.forEach(favicon => {
    if (favicon.href.endsWith('.svg')) favicon.parentNode?.removeChild(favicon)
  })
}

const updateFavicon = (status: CompileStatus = 'UNCOMPILED') => {
  removeFavicon()
  const linkElement = document.createElement('link')
  linkElement.rel = 'icon'
  linkElement.href = getMeta('ol-baseAssetPath') + COMPILE_ICONS[status]
  linkElement.type = 'image/svg+xml'
  linkElement.setAttribute('data-compile-status', 'true')
  document.head.appendChild(linkElement)
}

const isActive = () => !document.hidden

const useIsWindowActive = () => {
  const [isWindowActive, setIsWindowActive] = useState(isActive())
  useEffect(() => {
    const handleVisibilityChange = () => setIsWindowActive(isActive())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  return isWindowActive
}

export const useStatusFavicon = () => {
  const compileStatus = useCompileStatus()
  const previousCompileStatus = usePreviousValue(compileStatus)
  const isWindowActive = useIsWindowActive()

  useEffect(() => {
    if (previousCompileStatus !== compileStatus) {
      return updateFavicon(compileStatus)
    }

    if (
      isWindowActive &&
      (compileStatus === 'COMPILED' || compileStatus === 'ERROR')
    ) {
      const timeout = setTimeout(updateFavicon, RESET_AFTER_MS)
      return () => clearTimeout(timeout)
    }
  }, [compileStatus, isWindowActive, previousCompileStatus])
}
