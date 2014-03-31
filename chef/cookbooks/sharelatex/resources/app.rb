actions :start

attribute :revision, :kind_of => String, :default => "master"
attribute :repository, :kind_of => String
attribute :user, :kind_of => String, :default => "www-data"
attribute :group, :kind_of => String, :default => "www-data"
attribute :environment, :kind_of => Hash, :default => {}

def initialize(*args)
	super
	@action = :start
end

