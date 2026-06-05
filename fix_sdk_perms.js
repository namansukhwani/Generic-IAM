const fs = require('fs');
const file = 'packages/iam-sdk/src/constants/system-permissions.constant.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/:/g, '.');
fs.writeFileSync(file, content);
console.log('done');
