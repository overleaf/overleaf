import useEventListener from '@/shared/hooks/use-event-listener'
import { Dispatch, SetStateAction, useCallback } from 'react'
import { isMac } from '@/shared/utils/os'

const useCommandPaletteTriggers = (show: Dispatch<SetStateAction<boolean>>) => {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey
      if (modifierKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        show(prev => !prev)
      }
    },
    [show]
  )

  useEventListener('keydown', onKeyDown)
}

export default useCommandPaletteTriggers
