module.exports = {
  group: {
    modelName: 'Subscription',
    readOnly: true,
    hasMembersLimit: true,
    fields: {
      primaryKey: '_id',
      read: ['invited_emails', 'teamInvites', 'member_ids'],
      write: null,
      access: 'manager_ids',
      name: 'teamName'
    },
    baseQuery: {
      groupPlan: true
    },
    translations: {
      title: 'group_account',
      subtitle: 'members_management',
      remove: 'remove_from_group'
    },
    pathsFor(id) {
      return {
        addMember: `/manage/groups/${id}/invites`,
        removeMember: `/manage/groups/${id}/user`,
        removeInvite: `/manage/groups/${id}/invites`,
        exportMembers: `/manage/groups/${id}/members/export`
      }
    }
  },

  team: {
    // for metrics only
    modelName: 'Subscription',
    fields: {
      primaryKey: 'overleaf.id',
      access: 'manager_ids'
    },
    baseQuery: {
      groupPlan: true
    }
  },

  groupManagers: {
    modelName: 'Subscription',
    fields: {
      primaryKey: '_id',
      read: ['manager_ids'],
      write: 'manager_ids',
      access: 'manager_ids',
      name: 'teamName'
    },
    baseQuery: {
      groupPlan: true
    },
    translations: {
      title: 'group_account',
      subtitle: 'managers_management',
      remove: 'remove_manager'
    },
    pathsFor(id) {
      return {
        addMember: `/manage/groups/${id}/managers`,
        removeMember: `/manage/groups/${id}/managers`
      }
    }
  },

  institution: {
    modelName: 'Institution',
    fields: {
      primaryKey: 'v1Id',
      read: ['managerIds'],
      write: 'managerIds',
      access: 'managerIds',
      name: 'name'
    },
    translations: {
      title: 'institution_account',
      subtitle: 'managers_management',
      remove: 'remove_manager'
    },
    pathsFor(id) {
      return {
        index: `/manage/institutions/${id}/managers`,
        addMember: `/manage/institutions/${id}/managers`,
        removeMember: `/manage/institutions/${id}/managers`
      }
    }
  },

  publisher: {
    modelName: 'Publisher',
    fields: {
      primaryKey: 'slug',
      read: ['managerIds'],
      write: 'managerIds',
      access: 'managerIds',
      name: 'name'
    },
    translations: {
      title: 'publisher_account',
      subtitle: 'managers_management',
      remove: 'remove_manager'
    },
    pathsFor(id) {
      return {
        index: `/manage/publishers/${id}/managers`,
        addMember: `/manage/publishers/${id}/managers`,
        removeMember: `/manage/publishers/${id}/managers`
      }
    }
  }
}
