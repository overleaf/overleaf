import ErrorMessage from '../../../js/features/file-tree/components/file-tree-create/error-message'
import { FetchError } from '../../../js/infrastructure/fetch-json'
import {
  BlockedFilenameError,
  DuplicateFilenameError,
  InvalidFilenameError,
} from '../../../js/features/file-tree/errors'
import { bsVersionDecorator } from '../../../../.storybook/utils/with-bootstrap-switcher'

export const KeyedErrors = () => {
  return (
    <>
      <ErrorMessage error="name-exists" />
      <ErrorMessage error="too-many-files" />
      <ErrorMessage error="remote-service-error" />
      <ErrorMessage error="rate-limit-hit" />
      {/* <ErrorMessage error="not-logged-in" /> */}
      <ErrorMessage error="something-else" />
    </>
  )
}

export const FetchStatusErrors = () => {
  return (
    <>
      <ErrorMessage
        error={
          new FetchError(
            'There was an error',
            '/story',
            {},
            new Response(null, { status: 400 })
          )
        }
      />
      <ErrorMessage
        error={
          new FetchError(
            'There was an error',
            '/story',
            {},
            new Response(null, { status: 403 })
          )
        }
      />
      <ErrorMessage
        error={
          new FetchError(
            'There was an error',
            '/story',
            {},
            new Response(null, { status: 429 })
          )
        }
      />
      <ErrorMessage
        error={
          new FetchError(
            'There was an error',
            '/story',
            {},
            new Response(null, { status: 500 })
          )
        }
      />
    </>
  )
}

export const FetchDataErrors = () => {
  return (
    <>
      <ErrorMessage
        error={
          new FetchError('Error', '/story', {}, new Response(), {
            message: 'There was an error!',
          })
        }
      />
      <ErrorMessage
        error={
          new FetchError('Error', '/story', {}, new Response(), {
            message: {
              text: 'There was an error with some text!',
            },
          })
        }
      />
    </>
  )
}

export const SpecificClassErrors = () => {
  return (
    <>
      <ErrorMessage error={new DuplicateFilenameError()} />
      <ErrorMessage error={new InvalidFilenameError()} />
      <ErrorMessage error={new BlockedFilenameError()} />
      <ErrorMessage error={new Error()} />
    </>
  )
}

export default {
  title: 'Editor / Modals / Create File / Error Message',
  component: ErrorMessage,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
