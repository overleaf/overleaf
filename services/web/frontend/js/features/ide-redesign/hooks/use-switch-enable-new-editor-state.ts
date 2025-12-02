import { postJSON } from '@/infrastructure/fetch-json'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useCallback, useState } from 'react'

export const useSwitchEnableNewEditorState = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUserSettings } = useUserSettingsContext()
  const isNewEditorOptOutStage = useFeatureFlag('editor-redesign-opt-out')

  const setEditorRedesignStatus = useCallback(
    (status: boolean): Promise<void> => {
      setLoading(true)
      setError('')
      return new Promise((resolve, reject) => {
        postJSON(
          // Ensure that feature flag overrides are preserved in the request
          `/user/settings?editor-redesign-opt-out=${isNewEditorOptOutStage ? 'enabled' : 'default'}`,
          {
            body: { enableNewEditor: status },
          }
        )
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
    [setUserSettings, isNewEditorOptOutStage]
  )
  return { loading, error, setEditorRedesignStatus }
}
