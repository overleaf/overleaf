import { useEditorLeftMenuContext } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { useEffect, useState } from 'react'
import { useSettingsModalContext } from '../contexts/settings-modal-context'

/**
 *  A hook to scroll to and focus on a specific setting in the settings modal
 */
export default function useFocusOnSetting() {
  const { activeTab, setActiveTab, settingToTabMap } = useSettingsModalContext()
  const { settingToFocus } = useEditorLeftMenuContext()

  const [eltToScrollTo, setEltToScrollTo] = useState<{
    tab: string | undefined
    element: HTMLElement | null
  } | null>(null)

  useEffect(() => {
    if (settingToFocus) {
      const newActiveTab = settingToTabMap.get(settingToFocus)

      const settingElt: HTMLDivElement | null = document.querySelector(
        `#setting-${settingToFocus}`
      )

      const settingToFocusElt: HTMLElement | null =
        settingElt?.querySelector('input, select, button') ?? settingElt

      setActiveTab(newActiveTab)
      setEltToScrollTo({ tab: newActiveTab, element: settingToFocusElt })
    }

    // clear the focus setting
    window.dispatchEvent(
      new CustomEvent('ui.focus-setting', { detail: undefined })
    )
  }, [settingToFocus, activeTab, setActiveTab, settingToTabMap])

  // Scroll to the focused setting, once the correct tab is open
  useEffect(() => {
    if (!eltToScrollTo) {
      return
    }

    const { tab, element } = eltToScrollTo

    if (tab === activeTab) {
      element?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
      element?.focus()

      setEltToScrollTo(null)
    }
  }, [eltToScrollTo, activeTab])
}
