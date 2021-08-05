export const rootFolderBase = [
  {
    _id: '5e74f1a7ce17ae0041dfd054',
    name: 'rootFolder',
    folders: [
      {
        _id: '5f638e58b652df0026c5c8f5',
        name: 'a folder',
        folders: [
          {
            _id: '5f956f62700e19000177daa0',
            name: 'sub folder',
            folders: [],
            fileRefs: [],
            docs: [],
          },
        ],
        fileRefs: [
          { _id: '5cffb9d93da45d3995d05362', name: 'file-in-a-folder.pdf' },
        ],
        docs: [
          { _id: '5f46786322d556004e72a555', name: 'doc-in-a-folder.tex' },
        ],
      },
      {
        _id: '5f638e68b652df0026c5c8f6',
        name: 'another folder',
        folders: [],
        fileRefs: [],
        docs: [],
      },
    ],
    fileRefs: [{ _id: '5f11c78e0924770027412a67', name: 'univers.jpg' }],
    docs: [
      { _id: '5e74f1a7ce17ae0041dfd056', name: 'main.tex' },
      { _id: '5f46789522d556004e72a556', name: 'perso.bib' },
      {
        _id: '5da532e29019e800015321c6',
        name: 'zotero.bib',
        linkedFileData: { provider: 'zotero' },
      },
    ],
  },
]
