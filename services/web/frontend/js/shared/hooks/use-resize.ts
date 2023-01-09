import { useState, useEffect, useRef } from 'react'
import usePersistedState from './use-persisted-state'
import { Nullable } from '../../../../types/utils'

type Pos = Nullable<{
  x: number
}>

function useResizeBase(
  state: [Pos, React.Dispatch<React.SetStateAction<Pos>>]
) {
  const [mousePos, setMousePos] = state
  const isResizingRef = useRef(false)
  const handleRef = useRef<HTMLElement | null>(null)
  const defaultHandleStyles = useRef<React.CSSProperties>({
    cursor: 'col-resize',
    userSelect: 'none',
  })

  useEffect(() => {
    const handleMouseDown = function (e: MouseEvent) {
      if (e.button !== 0) {
        return
      }

      if (defaultHandleStyles.current.cursor) {
        document.body.style.cursor = defaultHandleStyles.current.cursor
      }

      isResizingRef.current = true
    }

    const handle = handleRef.current
    handle?.addEventListener('mousedown', handleMouseDown)

    return () => {
      handle?.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  useEffect(() => {
    const handleMouseUp = function () {
      document.body.style.cursor = 'default'
      isResizingRef.current = false
    }

    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = function (e: MouseEvent) {
      if (isResizingRef.current) {
        setMousePos({ x: e.clientX })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [setMousePos])

  const getTargetProps = ({ style }: { style?: React.CSSProperties } = {}) => {
    return {
      style: {
        ...style,
      },
    }
  }

  const setHandleRef = (node: HTMLElement | null) => {
    handleRef.current = node
  }

  const getHandleProps = ({ style }: { style?: React.CSSProperties } = {}) => {
    if (style?.cursor) {
      defaultHandleStyles.current.cursor = style.cursor
    }

    return {
      style: {
        ...defaultHandleStyles.current,
        ...style,
      },
      ref: setHandleRef,
    }
  }

  return <const>{
    mousePos,
    getHandleProps,
    getTargetProps,
  }
}

function useResize() {
  const state = useState<Pos>(null)

  return useResizeBase(state)
}

function usePersistedResize({ name }: { name: string }) {
  const state = usePersistedState<Pos>(`resizeable-${name}`, null)

  return useResizeBase(state)
}

export { useResize, usePersistedResize }
