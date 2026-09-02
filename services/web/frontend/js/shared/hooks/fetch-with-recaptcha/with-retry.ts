import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON,
  FetchError,
} from '@/infrastructure/fetch-json'

const isCloudArmorReject = (response: Response) => {
  // 'x-served-by' is only sent by our backend, so if it's missing and we have a 403,
  // it's likely a Cloud Armor block page
  return response.status === 403 && !response.headers.get('x-served-by')
}

export type FetchMethod<R> =
  | typeof getJSON<R>
  | typeof postJSON<R>
  | typeof deleteJSON<R>
  | typeof putJSON<R>

/**
 * Wraps a fetch method so it can be retried with a reCAPTCHA token if it fails due to Cloud Armor.
 */
export const withCaptchaRetry = async <R, M extends FetchMethod<R>>(
  method: M,
  ...fetchArgs: Parameters<M>
): Promise<
  | { status: 'ok'; data: R }
  | { status: 'retry'; retry: (token: string) => Promise<R>; error: FetchError }
> => {
  try {
    // @ts-expect-error - typescript does not infer the args type correctly here
    const data = (await method(...fetchArgs)) satisfies R
    return { status: 'ok', data }
  } catch (error) {
    if (
      error instanceof FetchError &&
      error.response &&
      isCloudArmorReject(error.response)
    ) {
      const retry = async (token: string) => {
        const [path, options, ...rest] = fetchArgs
        const newOptions = {
          ...options,
          headers: { ...(options?.headers || {}), 'x-recaptcha-token': token },
        }
        return await method(path, newOptions, ...rest)
      }
      return { status: 'retry', retry, error }
    }
    throw error
  }
}
