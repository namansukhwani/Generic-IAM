const fs = require('fs');

const controllers = [
  'src/modules/acl/acl.controller.ts',
  'src/modules/rbac/permission.controller.ts',
  'src/modules/rbac/role.controller.ts',
  'src/modules/rbac/assignment.controller.ts',
  'src/modules/auth/auth.controller.ts',
  'src/modules/super-admin/super-admin.controller.ts',
];

for (const file of controllers) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace("import { JwtPayload }", "import type { JwtPayload }");
  fs.writeFileSync(file, content);
}
console.log('done');
