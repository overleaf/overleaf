require 'rubygems'
require 'recurly'
require 'json'

if ENV['RECURLY_SUBDOMAIN']
	Recurly.subdomain = ENV['RECURLY_SUBDOMAIN']
else
	print "Defaulting to sharelatex-sandbox. Set RECURLY_SUBDOMAIN environment variable to override\n"
	Recurly.subdomain = "sharelatex-sandbox"
end

if ENV['RECURLY_API_KEY']
	Recurly.api_key = ENV['RECURLY_API_KEY']
else
	print "Please set RECURLY_API_KEY environment variable\n"
	exit 1
end

file = File.read('../../app/templates/plans/groups.json')
groups = JSON.parse(file)
# data format: groups[usage][plan_code][currency][size] = price

PLANS = {}
groups.each do |usage, data|
	data.each do |plan_code, data|
		data.each do |currency, data|
			data.each do |size, price|
				full_plan_code = "group_#{plan_code}_#{size}_#{usage}"
				plan = PLANS[full_plan_code] ||= {
					plan_code: full_plan_code,
					name: "Overleaf #{plan_code.capitalize} - Group Account (#{size} licenses) - #{usage.capitalize}",
					unit_amount_in_cents: {},
					plan_interval_length: 12,
					plan_interval_unit: 'months',
					tax_code: 'digital'
				}
				plan[:unit_amount_in_cents][currency] = price * 100
			end
		end
	end
end

PLANS.each do |plan_code, plan|
	print "Syncing #{plan_code}...\n"
	print "#{plan}\n"
	begin
		recurly_plan = Recurly::Plan.find(plan_code)
	rescue Recurly::Resource::NotFound => e
		recurly_plan = nil
	end

	if recurly_plan.nil?
		print "No plan found, creating...\n"
		Recurly::Plan.create(plan)
	else
		print "Existing plan found, updating...\n"
		plan.each do |key, value|
			recurly_plan[key] = value
			recurly_plan.save
		end
	end
	print "Done!\n"
end
