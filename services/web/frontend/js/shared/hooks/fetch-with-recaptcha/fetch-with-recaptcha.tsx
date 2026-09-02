import { useCallback, useState } from 'react'
import getMeta from '@/utils/meta'
import { withCaptchaRetry, type FetchMethod } from './with-retry'
import { OLModal, OLModalBody } from '@/shared/components/ol/ol-modal'
import RecaptchaConditions from '@/shared/components/recaptcha-conditions'
import OLSpinner from '@/shared/components/ol/ol-spinner'

const { recaptchaEnterpriseSiteKey } = getMeta('ol-ExposedSettings')

function loadRecaptchaEnterprise(siteKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.enterprise) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
    script.async = true
    script.onload = () => {
      window.grecaptcha!.enterprise!.ready(() => resolve())
    }
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'))
    document.head.appendChild(script)
  })
}

async function getEnterpriseToken(
  siteKey: string,
  action: string
): Promise<string> {
  await loadRecaptchaEnterprise(siteKey)
  return window.grecaptcha!.enterprise!.execute(siteKey, { action })
}

export const useFetchWithRecaptcha = <R, M extends FetchMethod<R>>(
  method: M,
  { action }: { action: string }
) => {
  const [isRetrying, setIsRetrying] = useState(false)

  const run = useCallback(
    async (...args: Parameters<M>): Promise<R> => {
      const result = await withCaptchaRetry<R, M>(method, ...args)
      if (result.status === 'ok') return result.data

      // Without the ability to retry, we throw the original error
      if (!recaptchaEnterpriseSiteKey) throw result.error

      setIsRetrying(true)

      try {
        const token = await getEnterpriseToken(
          recaptchaEnterpriseSiteKey,
          action
        )
        const data = await result.retry(token)
        return data
      } finally {
        setIsRetrying(false)
      }
    },
    [method, action]
  )

  const renderRecaptcha = useCallback(
    () =>
      isRetrying ? (
        <OLModal
          show
          size="sm"
          animation
          backdrop
          className="m-5"
          onHide={() => {}}
        >
          <OLSpinner size="lg" className="m-auto mt-3" />
          <OLModalBody>
            <RecaptchaConditions />
          </OLModalBody>
        </OLModal>
      ) : null,
    [isRetrying]
  )

  return { run, renderRecaptcha }
}
