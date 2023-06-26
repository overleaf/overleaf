import { useEffect, useState } from 'react'
import { useLocation } from './use-location'

function useBookmarkableTabSet(defaultState) {
  const location = useLocation()

  const [activeTabState, setActiveTabState] = useState(() => {
    const url = new URL(window.location.href)
    return url.hash.slice(1) || defaultState
  })

  function setActiveTab(eventKey) {
    setActiveTabState(eventKey)
    location.assign(`#${eventKey}`)
  }

  useEffect(() => {
    const handlePopstate = () => {
      const newUrl = new URL(window.location.href)
      setActiveTabState(newUrl.hash.slice(1) || defaultState)
    }

    window.addEventListener('popstate', handlePopstate)

    return () => {
      window.removeEventListener('popstate', handlePopstate)
    }
  })

  return [activeTabState, setActiveTab]
}

export default useBookmarkableTabSet
