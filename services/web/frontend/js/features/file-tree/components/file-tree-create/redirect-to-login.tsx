import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '../../../../shared/context/project-context'
import { useLocation } from '../../../../shared/hooks/use-location'

// handle "not-logged-in" errors by redirecting to the login page
export default function RedirectToLogin() {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()
  const [secondsToRedirect, setSecondsToRedirect] = useState(10)
  const location = useLocation()

  useEffect(() => {
    setSecondsToRedirect(10)

    const timer = window.setInterval(() => {
      setSecondsToRedirect(value => {
        if (value === 0) {
          window.clearInterval(timer)
          location.assign(`/login?redir=/project/${projectId}`)
          return 0
        }

        return value - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [projectId, location])

  return t('session_expired_redirecting_to_login', {
    seconds: secondsToRedirect,
  })
}
