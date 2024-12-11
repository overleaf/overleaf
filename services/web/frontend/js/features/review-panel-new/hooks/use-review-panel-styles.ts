import { CSSProperties, useCallback, useEffect, useState } from 'react'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import getMeta from '@/utils/meta'

export const useReviewPanelStyles = (mini: boolean) => {
  const view = useCodeMirrorViewContext()

  const [styles, setStyles] = useState<CSSProperties>({
    '--review-panel-header-height': getMeta('ol-isReviewerRoleEnabled')
      ? '36px'
      : '69px',
  } as CSSProperties)

  const updateScrollDomVariables = useCallback((element: HTMLDivElement) => {
    const { top, bottom } = element.getBoundingClientRect()

    setStyles(value => ({
      ...value,
      '--review-panel-top': `${top}px`,
      '--review-panel-bottom': `${bottom}px`,
    }))
  }, [])

  const updateContentDomVariables = useCallback((element: HTMLDivElement) => {
    const { height } = element.getBoundingClientRect()

    setStyles(value => ({
      ...value,
      '--review-panel-height': `${height}px`,
    }))
  }, [])

  useEffect(() => {
    setStyles(value => ({
      ...value,
      '--review-panel-width': mini ? '22px' : '230px',
    }))
  }, [mini])

  useEffect(() => {
    if ('ResizeObserver' in window) {
      const scrollDomObserver = new window.ResizeObserver(entries =>
        updateScrollDomVariables(entries[0]?.target as HTMLDivElement)
      )
      scrollDomObserver.observe(view.scrollDOM)

      const contentDomObserver = new window.ResizeObserver(entries =>
        updateContentDomVariables(entries[0]?.target as HTMLDivElement)
      )
      contentDomObserver.observe(view.contentDOM)

      return () => {
        scrollDomObserver.disconnect()
        contentDomObserver.disconnect()
      }
    }
  }, [view, updateScrollDomVariables, updateContentDomVariables])

  return styles
}
