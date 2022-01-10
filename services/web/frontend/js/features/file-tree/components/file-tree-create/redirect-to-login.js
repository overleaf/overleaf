import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Trans } from 'react-i18next'
import { useProjectContext } from '../../../../shared/context/project-context'

// handle "not-logged-in" errors by redirecting to the login page
export default function RedirectToLogin() {
  const { _id: projectId } = useProjectContext(projectContextPropTypes)

  const [secondsToRedirect, setSecondsToRedirect] = useState(10)

  useEffect(() => {
    setSecondsToRedirect(10)

    const timer = window.setInterval(() => {
      setSecondsToRedirect(value => {
        if (value === 0) {
          window.clearInterval(timer)
          window.location.assign(`/login?redir=/project/${projectId}`)
          return 0
        }

        return value - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [projectId])

  return (
    <Trans
      i18nKey="session_expired_redirecting_to_login"
      values={{ seconds: secondsToRedirect }}
    />
  )
}

const projectContextPropTypes = {
  _id: PropTypes.string.isRequired,
}
