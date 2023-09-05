import { useEffect, useRef } from 'react'
import { callFnsInSequence } from '../../utils/functions'
import { MergeAndOverride } from '../../../../types/utils'

export const resetHeight = (
  e:
    | React.ChangeEvent<HTMLTextAreaElement>
    | React.KeyboardEvent<HTMLTextAreaElement>
) => {
  const el = e.target as HTMLTextAreaElement

  window.requestAnimationFrame(() => {
    const curHeight = el.offsetHeight
    const fitHeight = el.scrollHeight
    // clear height if text area is empty
    if (!el.value.length) {
      el.style.removeProperty('height')
    }
    // otherwise expand to fit text
    else if (fitHeight > curHeight) {
      el.style.height = `${fitHeight}px`
    }
  })
}

type AutoExpandingTextAreaProps = MergeAndOverride<
  React.ComponentProps<'textarea'>,
  {
    onResize?: () => void
  }
>

function AutoExpandingTextArea({
  onChange,
  onResize,
  ...rest
}: AutoExpandingTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const previousHeightRef = useRef<number | null>(null)

  useEffect(() => {
    if (!ref.current || !onResize || !('ResizeObserver' in window)) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      // Ignore the resize that is triggered when the element is first
      // inserted into the DOM
      if (!ref.current) {
        return
      }
      const newHeight = ref.current.offsetHeight
      const heightChanged = newHeight !== previousHeightRef.current
      previousHeightRef.current = newHeight
      if (heightChanged) {
        // Prevent errors like "ResizeObserver loop completed with undelivered
        // notifications" that occur if onResize triggers another repaint. The
        // cost of this is that onResize lags one frame behind, but it's
        // unlikely to matter.

        // Wrap onResize to prevent extra parameters being passed
        window.requestAnimationFrame(() => onResize())
      }
    })

    resizeObserver.observe(ref.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [onResize])

  return (
    <textarea
      onChange={callFnsInSequence(onChange, resetHeight)}
      {...rest}
      ref={ref}
    />
  )
}

export default AutoExpandingTextArea
