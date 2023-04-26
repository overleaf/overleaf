A nodejs tool for reading plans prices from an Excel file and creating JSON objects.

Run `npm install` in order to install the `xlsx` dependency.

The scripts will put the output results into the `output` folder.

### Create localized and group plan pricing

_Command_ `node plans.js -f fileName -s sheetName -o outputdir` - generates three json files:

- `localizedPlanPricing.json` for `/services/web/config/settings.overrides.saas.js`
- `plans.json` for `/services/web/frontend/js/main/plans.js`
- `groups.json` for `/services/web/app/templates/plans/groups.json`

The input file can be in `.xls`, `.csv` or `.json` format

- `.xlsx` excel spreadsheet, requires the `-s sheetName` option
- `.csv` csv format, same data as for excel spreadsheet
- `.json` json format from the `recurly_prices.js --download` script output
