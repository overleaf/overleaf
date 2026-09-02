import { useEffect, useRef } from 'react'
import { elementIsInView } from '@/shared/utils/element-in-view'

type UseScrollIntoViewProps = {
  id: string | null
}

function useScrollIntoView({ id }: UseScrollIntoViewProps) {
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    if (!id) {
      return
    }

    const targetElement = document.getElementById(id)
    if (targetElement && !elementIsInView(targetElement)) {
      targetElement.scrollIntoView({ behavior: 'smooth' })
    }
  }, [id])
}

export default useScrollIntoView
