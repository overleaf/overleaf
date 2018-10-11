module.exports =
	group:
		modelName: 'Subscription'
		readOnly: true
		hasMembersLimit: true
		fields:
			read: ['invited_emails', 'teamInvites', 'member_ids']
			write: null
			access: 'manager_ids'
		baseQuery:
			groupPlan: true
		translations:
			title: 'group_account'
			remove: 'remove_from_group'
		pathsFor: () ->
			addMember: '/subscription/invites'
			removeMember: '/subscription/group/user'
			removeInvite: '/subscription/invites'
			exportMembers: '/subscription/group/export'

	groupManagers:
		modelName: 'Subscription'
		fields:
			read: ['manager_ids']
			write: 'manager_ids'
			access: 'manager_ids'
		baseQuery:
			groupPlan: true
		translations:
			title: 'group_managers'
			remove: 'remove_manager'
		pathsFor: (id) ->
			addMember: "/manage/groups/#{id}/managers"
			removeMember: "/manage/groups/#{id}/managers"

	institution:
		modelName: 'Institution'
		fields:
			read: ['managerIds']
			write: 'managerIds'
			access: 'managerIds'
		translations:
			title: 'institution_managers'
			remove: 'remove_manager'
		pathsFor: (id) ->
			addMember: "/manage/institutions/#{id}/managers"
			removeMember: "/manage/institutions/#{id}/managers"
