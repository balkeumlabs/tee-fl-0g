const fs = require('fs');
const path = require('path');
let Ajv;
try { Ajv = require('ajv'); } catch (e) {
  console.error('Missing dependency ajv. Run: npm i ajv --save-dev');
  process.exit(2);
}
const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.schema.json'), 'utf8'));
const validate = ajv.compile(schema);
const file = process.argv[2] || 'market_manifest.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!validate(data)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.log('manifest: OK');

