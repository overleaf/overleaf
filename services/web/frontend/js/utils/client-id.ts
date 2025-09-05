import { v4 as uuid } from 'uuid'

// Wrap uuid in an object method so that it can be stubbed
const clientId = uuid()
export default {
  get: () => clientId,
}
