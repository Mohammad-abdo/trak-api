/**
 * One-time backfill: link Role rows to Permission rows when role_permissions is empty
 * (main seed historically created roles + permissions but no junction rows).
 *
 * Run: node scripts/backfillRolePermissions.js
 * Safe to run multiple times (skipDuplicates).
 */

import prisma from "../utils/prisma.js";

const LINK_SETS = {
  admin: "all",
  manager: "all",
  fleet: ["rides", "rides.view", "rides.manage", "users", "users.view"],
  support: ["users", "users.view", "rides", "rides.view", "rides.manage", "roles", "roles.view"],
};

async function main() {
  const perms = await prisma.permission.findMany({ select: { id: true, name: true } });
  if (perms.length === 0) {
    console.error("[backfillRolePermissions] No permissions in DB. Seed permissions first.");
    process.exit(1);
  }
  const byName = Object.fromEntries(perms.map((p) => [p.name, p.id]));
  const allNames = perms.map((p) => p.name);

  const roles = await prisma.role.findMany({ where: { guardName: "web" } });
  const seen = new Set();
  const rows = [];

  for (const role of roles) {
    const spec = LINK_SETS[role.name];
    if (spec === undefined) continue;
    const names = spec === "all" ? allNames : spec;
    for (const name of names) {
      const permissionId = byName[name];
      if (!permissionId) continue;
      const key = `${role.id}:${permissionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ roleId: role.id, permissionId });
    }
  }

  if (rows.length === 0) {
    console.log("[backfillRolePermissions] Nothing to insert (no matching roles or links).");
    return;
  }

  const result = await prisma.rolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
  console.log(`[backfillRolePermissions] inserted (new): ${result.count} role-permission link(s) attempted=${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
