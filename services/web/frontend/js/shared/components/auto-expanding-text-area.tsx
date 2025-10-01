import { ChangeEvent, useCallback, useEffect, useRef } from 'react'
import { callFnsInSequence } from '../../utils/functions'
import { MergeAndOverride } from '../../../../types/utils'

type AutoExpandingTextAreaProps = MergeAndOverride<
  React.ComponentProps<'textarea'>,
  {
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
    onResize?: () => void
    onAutoFocus?: (textarea: HTMLTextAreaElement) => void
  }
>

function AutoExpandingTextArea({
  onChange,
  onResize,
  autoFocus,
  onAutoFocus,
  ...rest
}: AutoExpandingTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const previousHeightRef = useRef<number | null>(null)
  const previousMeasurementRef = useRef<{
    heightAdjustment: number
    value: string
  } | null>(null)

  const resetHeight = useCallback(() => {
    const el = ref.current
    if (!el) {
      return
    }

    const { value } = el
    const previousMeasurement = previousMeasurementRef.current

    // Do nothing if the textarea value hasn't changed since the last reset
    if (previousMeasurement !== null && value === previousMeasurement.value) {
      return
    }

    let heightAdjustment
    if (previousMeasurement === null) {
      const computedStyle = window.getComputedStyle(el)
      heightAdjustment =
        computedStyle.boxSizing === 'border-box'
          ? Math.ceil(
              parseFloat(computedStyle.borderTopWidth) +
                parseFloat(computedStyle.borderBottomWidth)
            )
          : -Math.floor(
              parseFloat(computedStyle.paddingTop) +
                parseFloat(computedStyle.paddingBottom)
            )
    } else {
      heightAdjustment = previousMeasurement.heightAdjustment
    }

    const curHeight = el.clientHeight
    const fitHeight = el.scrollHeight

    // Clear height if text area is empty
    if (value === '') {
      el.style.removeProperty('height')
    }
    // Otherwise, expand to fit text
    else if (fitHeight > curHeight) {
      el.style.height = fitHeight + heightAdjustment + 'px'
    }

    previousMeasurementRef.current = { heightAdjustment, value }
  }, [])

  useEffect(() => {
    if (!ref.current || !onResize || !('ResizeObserver' in window)) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!ref.current) {
        return
      }
      const newHeight = ref.current.offsetHeight
      // Ignore the resize when the height of the element is less than or equal to 0
      if (newHeight <= 0) {
        return
      }
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

  // Maintain a copy of onAutoFocus in a ref for use in the autofocus effect
  // below so that the effect doesn't run when onAutoFocus changes
  const onAutoFocusRef = useRef(onAutoFocus)
  useEffect(() => {
    onAutoFocusRef.current = onAutoFocus
  }, [onAutoFocus])

  // Implement autofocus manually so that the cursor is placed at the end of
  // the textarea content
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    resetHeight()
    if (autoFocus) {
      const cursorPos = el.value.length
      const timer = window.setTimeout(() => {
        el.focus()
        el.setSelectionRange(cursorPos, cursorPos)
        if (onAutoFocusRef.current) {
          onAutoFocusRef.current(el)
        }
      }, 100)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [autoFocus, resetHeight])

  // Reset height when the value changes via the `value` prop. If the textarea
  // is controlled, this means resetHeight is called twice per keypress, but
  // this is mitigated by a check on whether the value has actually changed in
  // resetHeight()
  useEffect(() => {
    resetHeight()
  }, [rest.value, resetHeight])

  return (
    <textarea
      onChange={callFnsInSequence(onChange, resetHeight)}
      {...rest}
      ref={ref}
    />
  )
}

export default AutoExpandingTextArea
