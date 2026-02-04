import { postJSON } from '@/infrastructure/fetch-json'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useCallback, useState } from 'react'

export const useSwitchEnableNewEditorState = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUserSettings } = useUserSettingsContext()

  const setEditorRedesignStatus = useCallback(
    (status: boolean): Promise<void> => {
      setLoading(true)
      setError('')
      return new Promise((resolve, reject) => {
        postJSON('/user/settings', {
          body: { enableNewEditor: status },
        })
          .then(() => {
            setUserSettings(current => ({
              ...current,
              enableNewEditor: status,
            }))
            resolve()
          })
          .catch(e => {
            setError('Failed to update settings')
            reject(e)
          })
          .finally(() => {
            setLoading(false)
          })
      })
    },
    [setUserSettings]
  )
  return { loading, error, setEditorRedesignStatus }
}
