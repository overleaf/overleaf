import useEventListener from '@/shared/hooks/use-event-listener'
import { Dispatch, SetStateAction, useCallback } from 'react'

const useCommandPaletteTriggers = (show: Dispatch<SetStateAction<boolean>>) => {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyP') {
        event.preventDefault()
        show(prev => !prev)
      }
    },
    [show]
  )

  useEventListener('keydown', onKeyDown)
}

export default useCommandPaletteTriggers
