import runScript from '../scripts/convert_archived_state.mjs'

const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  await runScript('FIRST,SECOND')
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
