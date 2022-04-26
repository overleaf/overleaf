import { useEffect, useState } from 'react'
import i18n from '../../../js/i18n'
import { useTranslation } from 'react-i18next'

function useWaitForI18n() {
  const { ready: isHookReady } = useTranslation()
  const [isLocaleDataLoaded, setIsLocaleDataLoaded] = useState(false)

  useEffect(() => {
    i18n.then(() => {
      setIsLocaleDataLoaded(true)
    })
  }, [])

  return {
    isReady: isHookReady && isLocaleDataLoaded,
  }
}

export default useWaitForI18n
