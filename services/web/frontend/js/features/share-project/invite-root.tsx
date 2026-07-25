import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import Invite from '@/features/share-project/invite'
import useAsync from '@/shared/hooks/use-async'
import { postJSON } from '@/infrastructure/fetch-json'
import { useLocation } from '@/shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import InviteNotValid from './invite-not-valid'
import { useEffect, useState } from 'react'

type ValidateResponse = {
  valid: boolean
  projectName?: string
  redirect?: boolean
}

export default function InviteRoot() {
  const user = getMeta('ol-user')
  const projectName = getMeta('ol-projectName')
  const projectId = getMeta('ol-project_id')
  const token = getMeta('ol-inviteToken')
  const location = useLocation()
  const hashToken = document.location.hash.replace('#', '')
  const { isLoading, runAsync } = useAsync()
  const { isReady } = useWaitForI18n()
  const [validateResponse, setValidateResponse] = useState<ValidateResponse>({
    valid: false,
  })

  // If a sharing link (ie. token is in hash), validate the user can use this link
  useEffect(() => {
    const validate = async () => {
      if (hashToken) {
        try {
          const result = await runAsync(
            postJSON(`/project/${projectId}/share/validate`, {
              body: { token: hashToken },
            })
          )
          setValidateResponse(result)
          if (result.redirect) {
            location.replace(`/project/${projectId}`)
          }
        } catch (err) {
          debugConsole.error('Error validating sharing link', err)
          setValidateResponse({ valid: false })
        }
      } else {
        setValidateResponse({ valid: false })
      }
    }
    // Always treat URL tokens as valid, they are validated on the backend before
    // rendering this page.
    if (token) {
      setValidateResponse({ valid: true })
      return
    }
    validate()
  }, [token, hashToken, projectId, runAsync, location])

  const handleSubmit = () => {
    if (token) {
      runAsync(postJSON(`/project/${projectId}/invite/token/${token}/accept`))
        .then(() => location.assign(`/project/${projectId}`))
        .catch(debugConsole.error)
    } else if (hashToken) {
      runAsync(
        postJSON(`/project/${projectId}/share`, { body: { token: hashToken } })
      )
        .then(() => location.assign(`/project/${projectId}`))
        .catch(debugConsole.error)
    }
  }

  if (!isReady || isLoading || validateResponse.redirect) {
    return null
  }

  if ((!token && !hashToken) || !validateResponse.valid) {
    return <InviteNotValid email={user?.email} />
  }

  return (
    <Invite
      projectName={validateResponse.projectName || projectName}
      email={user.email}
      submitHandler={handleSubmit}
      isLoading={isLoading}
    />
  )
}
