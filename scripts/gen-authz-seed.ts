import { writeFileSync } from "node:fs";
import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES, SYSTEM_ROLE_CODES } from "../lib/authz/bundles";

function sql(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

const permInserts = PERMISSION_KEYS.map((k) => {
  const domain = k.split(".")[0]!;
  return `  (${sql(k)}, ${sql(domain)}, ${sql(k)})`;
}).join(",\n");

const rolePerms: string[] = [];
for (const code of SYSTEM_ROLE_CODES) {
  for (const key of SYSTEM_ROLE_BUNDLES[code]) {
    rolePerms.push(
      `  ((select id from public.authz_roles where code = ${sql(code)} and is_system = true limit 1), ${sql(key)})`,
    );
  }
}

const roles = SYSTEM_ROLE_CODES.map(
  (code) =>
    `  (${sql(code)}, ${sql(code.replaceAll("_", " "))}, true, null)`,
).join(",\n");

writeFileSync(
  "/tmp/authz_seed.sql",
  `-- generated\ninsert into public.authz_permissions (key, domain, description) values\n${permInserts}\non conflict (key) do nothing;\n\ninsert into public.authz_roles (code, name, is_system, school_id) values\n${roles}\non conflict do nothing;\n\ninsert into public.authz_role_permissions (role_id, permission_key) values\n${rolePerms.join(",\n")}\non conflict do nothing;\n`,
);
console.log("wrote /tmp/authz_seed.sql", PERMISSION_KEYS.length, rolePerms.length);
