export default {
  group: {
    modelName: 'Subscription',
    readOnly: true,
    hasMembersLimit: true,
    fields: {
      primaryKey: '_id',
      read: ['invited_emails', 'teamInvites', 'member_ids'],
      write: null,
      access: 'manager_ids',
      membership: 'member_ids',
      name: 'teamName',
    },
    baseQuery: {
      groupPlan: true,
    },
  },

  team: {
    // for metrics only
    modelName: 'Subscription',
    fields: {
      primaryKey: 'overleaf.id',
      access: 'manager_ids',
    },
    baseQuery: {
      groupPlan: true,
    },
  },

  groupManagers: {
    modelName: 'Subscription',
    fields: {
      primaryKey: '_id',
      read: ['manager_ids'],
      write: 'manager_ids',
      access: 'manager_ids',
      membership: 'member_ids',
      name: 'teamName',
    },
    baseQuery: {
      groupPlan: true,
    },
  },

  groupMember: {
    modelName: 'Subscription',
    readOnly: true,
    hasMembersLimit: true,
    fields: {
      primaryKey: '_id',
      read: ['member_ids'],
      write: null,
      access: 'member_ids',
      membership: 'member_ids',
      name: 'teamName',
    },
    baseQuery: {
      groupPlan: true,
    },
  },

  groupAdmin: {
    modelName: 'Subscription',
    fields: {
      primaryKey: '_id',
      read: ['admin_id'],
      write: null,
      access: 'admin_id',
      membership: 'admin_id',
      name: 'teamName',
    },
    baseQuery: {
      groupPlan: true,
    },
  },

  institution: {
    modelName: 'Institution',
    fields: {
      primaryKey: 'v1Id',
      read: ['managerIds'],
      write: 'managerIds',
      access: 'managerIds',
      membership: 'member_ids',
      name: 'name',
    },
    pathsFor(id) {
      return {
        index: `/manage/institutions/${id}/managers`,
      }
    },
  },

  publisher: {
    modelName: 'Publisher',
    fields: {
      primaryKey: 'slug',
      read: ['managerIds'],
      write: 'managerIds',
      access: 'managerIds',
      membership: 'member_ids',
      name: 'name',
    },
    pathsFor(id) {
      return {
        index: `/manage/publishers/${id}/managers`,
      }
    },
  },
}
