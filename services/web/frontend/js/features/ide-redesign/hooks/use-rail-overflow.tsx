import { useCallback, useState } from 'react'
import { RailElement } from '../utils/rail-types'
import { useResizeObserver } from '@/shared/hooks/use-resize-observer'

const useRailOverflow = (railTabs: RailElement[]) => {
  const [tabsInRail, setTabsInRail] = useState<RailElement[]>(railTabs)
  const [tabsInOverflow, setTabsInOverflow] = useState<RailElement[]>([])

  const handleResize = useCallback(
    (element: Element) => {
      const height = (element as HTMLElement).offsetHeight

      const tabHeight =
        (element.querySelector('.ide-rail-tab-link')?.clientHeight ?? 0) + 4 // 4px gap between tabs

      const numTabsToFit = Math.floor(height / tabHeight)

      if (numTabsToFit >= railTabs.length) {
        setTabsInRail(railTabs)
        setTabsInOverflow([])
      } else {
        const sliceIndex = Math.max(numTabsToFit - 1, 0)
        setTabsInRail(railTabs.slice(0, sliceIndex))
        setTabsInOverflow(railTabs.slice(sliceIndex))
      }
    },
    [railTabs]
  )

  const { elementRef: tabWrapperRef } = useResizeObserver(handleResize)

  return { tabsInRail, tabsInOverflow, tabWrapperRef }
}

export default useRailOverflow
