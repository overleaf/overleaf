import { useEffect, useState } from 'react'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'

function useWaitForI18n() {
  const { ready: isHookReady } = useTranslation()
  const [isLocaleDataLoaded, setIsLocaleDataLoaded] = useState(false)
  const [error, setError] = useState<Error>()

  useEffect(() => {
    i18n
      .then(() => {
        setIsLocaleDataLoaded(true)
      })
      .catch(error => {
        setError(error)
      })
  }, [])

  return {
    isReady: isHookReady && isLocaleDataLoaded,
    error,
  }
}

export default useWaitForI18n
