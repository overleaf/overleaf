import sinon from 'sinon'

export const contextProps = {
  projectId: 'test-project',
  hasWritePermissions: true,
  userHasFeature: () => true,
  refProviders: {},
  reindexReferences: () => {
    console.log('reindex references')
  },
  setRefProviderEnabled: provider => {
    console.log(`ref provider ${provider} enabled`)
  },
  setStartedFreeTrial: () => {
    console.log('started free trial')
  },
  rootFolder: [
    {
      docs: [{ _id: 'entity-1' }],
      fileRefs: [],
      folders: []
    }
  ],
  initialSelectedEntityId: 'entity-1',
  onSelect: sinon.stub()
}
