A nodejs tool for reading plans prices from an Excel file and creating JSON objects.

Run `npm install` in order to install the `xlsx` dependency.

The scripts will put the output results into the `output` folder.

### Create group plans

_Command_ `node groups.js fileName sheetName` - generates group plans prices. To be used for `/services/web/app/templates/plans/groups.json`

### Create localized plan pricing

_Command_ `node plans.js fileName sheetName` - generates two json files:
- `localizedPlanPricing.json` for `/services/web/config/settings.overrides.saas.js`
- `plans.json` for `/services/web/frontend/js/main/plans.js`
