module.exports = [
  {
    name: 'web',
  },
  {
    name: 'real-time',
  },
  {
    name: 'document-updater',
  },
  {
    name: 'clsi',
  },
  {
    name: 'filestore',
  },
  {
    name: 'docstore',
  },
  {
    name: 'chat',
  },
  {
    name: 'contacts',
  },
  {
    name: 'notifications',
  },
  {
    name: 'project-history',
  },
  {
    name: 'history-v1',
  },
]

if (require.main === module) {
  for (const service of module.exports) {
    console.log(service.name)
  }
}
