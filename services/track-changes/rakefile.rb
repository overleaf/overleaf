require 'fileutils'

siteurl = "https://www.sharelatex.com"

desc "Compile JavaScirpt into CoffeeScript"
namespace 'setup' do

	desc "installes npm packages json and global stuff like less"
	task :installDependencys do
		sh %{npm install}
		sh %{npm install -g coffee-script}
		sh %{git submodule init}
		sh %{git submodule update}
	end
end


namespace 'run' do
	desc "compiles and runs the javascirpt version of the app"
	task :app => ["compile:app"] do
		sh %{node app.js | bunyan} do |ok, res|
			if ! ok
				raise "error compiling app folder tests : #{res}"
			end
			puts 'finished app compile'
		end
	end
end

namespace 'compile' do
	desc "compiles main app folder"
	task :app  do
		puts "Compiling app folder to JS"
		FileUtils.rm_rf "app/js"
		sh %{coffee -c -o app/js/ app/coffee/} do |ok, res|
			if ! ok
				raise "error compiling app folder tests : #{res}"
			end
			puts 'finished app compile'
		end
	end

	desc "compiles unit tests"
	task :unittests => ["compile:app"] do
		puts "Compiling Unit Tests to JS"
		`coffee -c -o test/unit/js/ test/unit/coffee/`
	end

	desc "compiles acceptance tests"
	task :acceptancetests => ["compile:app"] do
		puts "Compiling Acceptance Tests to JS"
		sh %{coffee -c -o test/acceptance/js/ test/acceptance/coffee/} do |ok, res|
			if ! ok
				raise "error compiling acceptance tests: #{res}"
			end
		end
	end
end

namespace 'test' do

	desc "runs all test"
	task :all => ["test:unit", "test:acceptance"] do
		puts "testing everything"
	end

	desc "Run Acceptance Tests"
	task :acceptance => ["compile:acceptancetests"]do
		puts "Running Acceptance Tests"
		feature = ENV['feature']
		if feature.nil?
			featureFlags = ""
		else
			featureFlags = "-g \"#{feature}\""
		end
		sh %{mocha -R spec #{featureFlags} test/acceptance/js/*} do |ok, res|
			if ! ok
				raise "error running acceptance tests: #{res}"
			end
		end
	end

	desc "run unit tests"
	task :unit => ["compile:unittests"]do
		puts "Running Unit Tests"
		featurePath = ENV['feature']
		puts featurePath
		if featurePath.nil?
			featurePath = ''
		elsif featurePath.include? '/'
		elsif !featurePath.include? '/'
			featurePath +='/'
		else
			featurePath = ''
		end

		sh %{mocha -R spec test/unit/js/#{featurePath}* --ignore-leaks} do |ok, res|
			if ! ok
				raise "error running unit tests : #{res}"
			end
		end
	end
end


namespace 'deploy' do
	desc "safley deploys app"
	task :live do
		sh %{git push origin}
		sh %{cap live deploy}
	end
end
