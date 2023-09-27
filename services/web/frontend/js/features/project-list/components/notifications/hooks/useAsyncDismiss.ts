import useAsync from '../../../../../shared/hooks/use-async'
import { deleteJSON } from '../../../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'

function useAsyncDismiss() {
  const { runAsync, ...rest } = useAsync()

  const handleDismiss = (id: number | string) => {
    runAsync(deleteJSON(`/notifications/${id}`)).catch(debugConsole.error)
  }

  return { handleDismiss, ...rest }
}

export default useAsyncDismiss
