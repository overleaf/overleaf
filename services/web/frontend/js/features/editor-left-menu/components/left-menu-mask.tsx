import { memo, useEffect, useRef, useState } from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'

export default memo(function LeftMenuMask() {
  const { setLeftMenuShown } = useLayoutContext()
  const { userSettings } = useUserSettingsContext()
  const { editorTheme, editorLightTheme, editorDarkTheme, overallTheme } =
    userSettings
  const [original] = useState({
    editorTheme,
    overallTheme,
    editorLightTheme,
    editorDarkTheme,
  })
  const maskRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (maskRef.current) {
      if (
        editorTheme !== original.editorTheme ||
        editorLightTheme !== original.editorLightTheme ||
        editorDarkTheme !== original.editorDarkTheme ||
        overallTheme !== original.overallTheme
      ) {
        maskRef.current.style.opacity = '0'
      }
    }
  }, [editorTheme, editorLightTheme, editorDarkTheme, overallTheme, original])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      id="left-menu-mask"
      ref={maskRef}
      onClick={() => setLeftMenuShown(false)}
    />
  )
})
