actions :start

attribute :revision, :kind_of => String, :default => "master"
attribute :repository, :kind_of => String
attribute :user, :kind_of => String, :default => "www-data"

def initialize(*args)
	super
	@action = :start
end

