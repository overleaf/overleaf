if defined?(ChefSpec)
  def add_apt_preference(resource_name)
    ChefSpec::Matchers::ResourceMatcher.new(:apt_preference, :add, resource_name)
  end

  def remove_apt_preference(resource_name)
    ChefSpec::Matchers::ResourceMatcher.new(:apt_preference, :remove, resource_name)
  end

  def add_apt_repository(resource_name)
    ChefSpec::Matchers::ResourceMatcher.new(:apt_repository, :add, resource_name)
  end

  def remove_apt_repository(resource_name)
    ChefSpec::Matchers::ResourceMatcher.new(:apt_repository, :remove, resource_name)
  end
end
