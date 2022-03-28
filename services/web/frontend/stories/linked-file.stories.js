import { LinkedFileInfo } from '../../modules/tpr-webmodule/frontend/js/components/linked-file-info'

export const MendeleyLinkedFile = args => {
  return <LinkedFileInfo {...args} />
}

MendeleyLinkedFile.args = {
  file: {
    linkedFileData: {
      provider: 'mendeley',
    },
  },
}

export default {
  title: 'Editor / LinkedFileInfo',
  component: LinkedFileInfo,
  args: {
    file: {
      id: 'file-id',
      name: 'file.tex',
      created: new Date(),
    },
  },
}
