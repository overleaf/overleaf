action :start do
	package "git"
	package "build-essential"

	r = new_resource

	deploy_to = "/var/www/" + r.name

	node_environment = "production"

	directory deploy_to do
		user r.user if r.user
		recursive true
	end

	env = {
		"HOME" => deploy_to
	}

	directory "#{deploy_to}/releases" do
		user r.user if r.user
		recursive true
	end

	shared_dir = "#{deploy_to}/shared"
	directory shared_dir do
		user r.user if r.user
		recursive true
	end
	directory "#{shared_dir}/config" do
		user r.user if r.user
		recursive true
	end
	directory "#{shared_dir}/log" do
		user r.user if r.user
		recursive true
	end

	deploy_revision deploy_to do
		repository r.repository
		revision r.revision
		user r.user if r.user

		purge_before_symlink [
			"log", "config", "node_modules"
		]
		create_dirs_before_symlink []
		symlinks({
			"log"    => "log",
			"config" => "config"
		})
		symlink_before_migrate({
			"node_modules" => "node_modules"
		})

		environment env

		migrate true
		migration_command "npm install; grunt install"

		before_migrate do
			directory "#{deploy_to}/shared/node_modules" do
				user r.user if r.user
				recursive true
			end
		end

		notifies :restart, "service[#{r.name}]"
	end

	file "/etc/init/#{r.name}.conf" do
		content <<-EOS
			description "#{r.name}"
			author      "ShareLaTeX <team@sharelatex.com>"

			start on started mountall
			stop on shutdown

			respawn

			limit nofile 8192 8192
			
			script
				echo $$ > /var/run/#{r.name}.pid
				chdir #{deploy_to}/current
				exec sudo -u #{r.user} env NODE_ENV=#{node_environment} SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee node app.js >> log/production.log
			end script
		EOS
	end

	directory "/etc/sharelatex"
	template "/etc/sharelatex/settings.coffee" do
		mode 0400
		user "www-data"
		notifies :restart, "service[#{r.name}]"
	end

	service "#{r.name}" do
		provider Chef::Provider::Service::Upstart
		action :start
	end

	file "/etc/logrotate.d/#{r.name}" do
		content <<-EOS
			#{deploy_to}/shared/log/*.log {
				rotate 7
				size 5M
				missingok
				compress
				copytruncate
			}
		EOS
	end
end