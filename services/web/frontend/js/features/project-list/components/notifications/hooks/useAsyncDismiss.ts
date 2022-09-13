import useAsync from '../../../../../shared/hooks/use-async'
import { deleteJSON } from '../../../../../infrastructure/fetch-json'

function useAsyncDismiss() {
  const { runAsync, ...rest } = useAsync()

  const handleDismiss = (id: number | string) => {
    runAsync(deleteJSON(`/notifications/${id}`)).catch(console.error)
  }

  return { handleDismiss, ...rest }
}

export default useAsyncDismiss
