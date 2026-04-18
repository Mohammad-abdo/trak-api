/**
 * Single source of truth for dashboard RBAC (staff roles).
 * Used by prisma/seed-staff.js — keep in sync with offerGo/src/utils/routeAccess.js.
 *
 * Convention: parent row (e.g. "users") + leaf rows ("users.view", …).
 */

/** @type {{ name: string, children: string[] }[]} */
export const PERMISSION_TREE = [
  { name: "dashboard", children: ["dashboard.view"] },
  {
    name: "users",
    children: ["users.view", "users.create", "users.update", "users.delete"],
  },
  {
    name: "drivers",
    children: [
      "drivers.view",
      "drivers.create",
      "drivers.update",
      "drivers.delete",
      "drivers.approve",
    ],
  },
  {
    name: "riders",
    children: ["riders.view", "riders.create", "riders.update", "riders.delete"],
  },
  {
    name: "roles",
    children: ["roles.view", "roles.create", "roles.update", "roles.delete"],
  },
  {
    name: "rides",
    children: ["rides.view", "rides.manage", "rides.cancel", "rides.assign"],
  },
  {
    name: "dispatch",
    children: ["dispatch.view", "dispatch.manage"],
  },
  {
    name: "maps",
    children: ["maps.view", "maps.tracking"],
  },
  {
    name: "services",
    children: ["services.view", "services.create", "services.update", "services.delete"],
  },
  {
    name: "zones",
    children: ["zones.view", "zones.manage", "zones.pricing"],
  },
  {
    name: "pricing",
    children: ["pricing.view", "pricing.update"],
  },
  {
    name: "trips",
    children: ["trips.tourist.view", "trips.tourist.manage", "trips.dedicated.view", "trips.dedicated.manage"],
  },
  {
    name: "promotions",
    children: ["promotions.view", "promotions.create", "promotions.update", "promotions.delete"],
  },
  {
    name: "coupons",
    children: ["coupons.view", "coupons.create", "coupons.update", "coupons.delete"],
  },
  {
    name: "payments",
    children: ["payments.view", "payments.manage", "payments.refund"],
  },
  {
    name: "wallets",
    children: ["wallets.view", "wallets.manage", "wallets.withdraw"],
  },
  {
    name: "reports",
    children: ["reports.view", "reports.export"],
  },
  {
    name: "complaints",
    children: ["complaints.view", "complaints.manage"],
  },
  {
    name: "settings",
    children: ["settings.view", "settings.update"],
  },
  {
    name: "content",
    children: [
      "content.pages",
      "content.frontend",
      "content.mail",
      "content.sms",
      "content.languages",
    ],
  },
  {
    name: "documents",
    children: ["documents.view", "documents.manage"],
  },
  {
    name: "notifications",
    children: ["notifications.view", "notifications.send"],
  },
  {
    name: "support",
    children: ["support.tickets", "support.chat"],
  },
  {
    name: "bulk",
    children: ["bulk.manage"],
  },
  {
    name: "airports",
    children: ["airports.view", "airports.manage"],
  },
  {
    name: "analytics",
    children: ["analytics.view"],
  },
]

/**
 * Flat list of all permission names (parents + children) for assigning "full access" roles.
 */
export function flattenAllPermissionNames() {
  const out = []
  for (const g of PERMISSION_TREE) {
    out.push(g.name)
    out.push(...g.children)
  }
  return [...new Set(out)]
}

/**
 * Default role → permission names (subset of flattenAllPermissionNames).
 * manager: full access via seed loop (all names).
 */
export const ROLE_PRESETS = {
  support: [
    "dashboard",
    "dashboard.view",
    "users",
    "users.view",
    "drivers",
    "drivers.view",
    "riders",
    "riders.view",
    "rides",
    "rides.view",
    "rides.manage",
    "dispatch",
    "dispatch.view",
    "maps",
    "maps.view",
    "wallets",
    "wallets.view",
    "complaints",
    "complaints.view",
    "complaints.manage",
    "documents",
    "documents.view",
    "documents.manage",
    "notifications",
    "notifications.view",
    "notifications.send",
    "promotions",
    "promotions.view",
    "coupons",
    "coupons.view",
    "payments",
    "payments.view",
    "settings",
    "settings.view",
    "support",
    "support.tickets",
    "support.chat",
  ],
  operations: [
    "dashboard",
    "dashboard.view",
    "drivers",
    "drivers.view",
    "drivers.update",
    "drivers.approve",
    "rides",
    "rides.view",
    "rides.manage",
    "rides.cancel",
    "rides.assign",
    "dispatch",
    "dispatch.view",
    "dispatch.manage",
    "maps",
    "maps.view",
    "maps.tracking",
    "zones",
    "zones.view",
    "services",
    "services.view",
    "wallets",
    "wallets.view",
    "reports",
    "reports.view",
    "complaints",
    "complaints.view",
    "documents",
    "documents.view",
    "documents.manage",
    "trips",
    "trips.tourist.view",
    "trips.dedicated.view",
    "trips.dedicated.manage",
    "bulk",
    "bulk.manage",
  ],
  accountant: [
    "dashboard",
    "dashboard.view",
    "wallets",
    "wallets.view",
    "wallets.manage",
    "wallets.withdraw",
    "payments",
    "payments.view",
    "payments.manage",
    "reports",
    "reports.view",
    "reports.export",
    "rides",
    "rides.view",
    "users",
    "users.view",
    "drivers",
    "drivers.view",
    "promotions",
    "promotions.view",
    "coupons",
    "coupons.view",
  ],
}
