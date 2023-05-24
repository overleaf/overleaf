import { memo, useEffect, useRef, useState } from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'

export default memo(function LeftMenuMask() {
  const { setLeftMenuShown } = useLayoutContext()
  const [editorTheme] = useScopeValue('settings.editorTheme')
  const [overallTheme] = useScopeValue('settings.overallTheme')
  const [original] = useState({ editorTheme, overallTheme })
  const maskRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (maskRef.current) {
      if (
        editorTheme !== original.editorTheme ||
        overallTheme !== original.overallTheme
      ) {
        maskRef.current.style.opacity = '0'
      }
    }
  }, [editorTheme, overallTheme, original])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      id="left-menu-mask"
      ref={maskRef}
      onClick={() => setLeftMenuShown(false)}
    />
  )
})
