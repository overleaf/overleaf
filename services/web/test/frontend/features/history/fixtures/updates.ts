import { USER_ID, USER_EMAIL } from '../../../helpers/editor-providers'

export const updates = {
  updates: [
    {
      fromV: 3,
      toV: 4,
      meta: {
        users: [
          {
            first_name: 'testuser',
            last_name: '',
            email: USER_EMAIL,
            id: USER_ID,
          },
          {
            first_name: 'john.doe',
            last_name: '',
            email: 'john.doe@test.com',
            id: '631710ab1094c5002647184e',
          },
        ],
        start_ts: 1681220036419,
        end_ts: 1681220036419,
      },
      labels: [
        {
          id: '643561cdfa2b2beac88f0024',
          comment: 'tag-1',
          version: 4,
          user_id: USER_ID,
          created_at: '2023-04-11T13:34:05.856Z',
        },
        {
          id: '643561d1fa2b2beac88f0025',
          comment: 'tag-2',
          version: 4,
          user_id: USER_ID,
          created_at: '2023-04-11T13:34:09.280Z',
        },
      ],
      pathnames: [],
      project_ops: [{ add: { pathname: 'name.tex' }, atV: 3 }],
    },
    {
      fromV: 1,
      toV: 3,
      meta: {
        users: [
          {
            first_name: 'bobby.lapointe',
            last_name: '',
            email: 'bobby.lapointe@test.com',
            id: '631710ab1094c5002647184e',
          },
        ],
        start_ts: 1681220029569,
        end_ts: 1681220031589,
      },
      labels: [],
      pathnames: ['main.tex'],
      project_ops: [],
    },
    {
      fromV: 0,
      toV: 1,
      meta: {
        users: [
          {
            first_name: 'john.doe',
            last_name: '',
            email: 'john.doe@test.com',
            id: '631710ab1094c5002647184e',
          },
        ],
        start_ts: 1669218226672,
        end_ts: 1669218226672,
      },
      labels: [
        {
          id: '6436bcf630293cb49e7f13a4',
          comment: 'tag-3',
          version: 3,
          user_id: '631710ab1094c5002647184e',
          created_at: '2023-04-12T14:15:18.892Z',
        },
        {
          id: '6436bcf830293cb49e7f13a5',
          comment: 'tag-4',
          version: 3,
          user_id: '631710ab1094c5002647184e',
          created_at: '2023-04-12T14:15:20.814Z',
        },
      ],
      pathnames: [],
      project_ops: [{ add: { pathname: 'main.tex' }, atV: 0 }],
    },
  ],
}
