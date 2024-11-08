import { OLToast, OLToastProps } from '@/features/ui/components/ol/ol-toast'
import useEventListener from '@/shared/hooks/use-event-listener'
import { Fragment, ReactElement, useCallback, useState } from 'react'

import { debugConsole } from '@/utils/debugging'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { OLToastContainer } from '@/features/ui/components/ol/ol-toast-container'

const moduleGeneratorsImport = importOverleafModules('toastGenerators') as {
  import: { default: GlobalToastGeneratorEntry[] }
}[]

const moduleGenerators = moduleGeneratorsImport.map(
  ({ import: { default: listEntry } }) => listEntry
)

export type GlobalToastGeneratorEntry = {
  key: string
  generator: GlobalToastGenerator
}

type GlobalToastGenerator = (
  args: Record<string, any>
) => Omit<OLToastProps, 'onDismiss'>

const GENERATOR_LIST: GlobalToastGeneratorEntry[] = moduleGenerators.flat()
const GENERATOR_MAP: Map<string, GlobalToastGenerator> = new Map(
  GENERATOR_LIST.map(({ key, generator }) => [key, generator])
)

let toastCounter = 1

export const GlobalToasts = () => {
  const [toasts, setToasts] = useState<
    { component: ReactElement; id: string }[]
  >([])

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const createToast = useCallback(
    (id: string, key: string, data: any): ReactElement | null => {
      const generator = GENERATOR_MAP.get(key)
      if (!generator) {
        debugConsole.error('No toast generator found for key:', key)
        return null
      }

      const props = generator(data)

      if (!props.autoHide && !props.isDismissible) {
        // We don't want any toasts that are not dismissible and don't auto-hide
        props.isDismissible = true
      }
      if (props.autoHide && !props.isDismissible && props.delay !== undefined) {
        // If the toast is auto-hiding but not dismissible, we need to make sure the delay is not too long
        props.delay = Math.min(props.delay, 60_000)
      }

      return <OLToast {...props} onDismiss={() => removeToast(id)} />
    },
    [removeToast]
  )

  const addToast = useCallback(
    (key: string, data?: any) => {
      const id = `toast-${toastCounter++}`
      const component = createToast(id, key, data)
      if (!component) {
        return
      }
      setToasts(current => [...current, { id, component }])
    },
    [createToast]
  )

  const showToastListener = useCallback(
    (event: CustomEvent) => {
      if (!event.detail?.key) {
        debugConsole.error('No key provided for toast')
        return
      }
      const { key, ...rest } = event.detail
      addToast(key, rest)
    },
    [addToast]
  )

  useEventListener('ide:show-toast', showToastListener)

  return (
    <OLToastContainer className="global-toasts">
      {toasts.map(({ component, id }) => (
        <Fragment key={id}>{component}</Fragment>
      ))}
    </OLToastContainer>
  )
}
