import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Seeding staff employees with roles & permissions...\n')

  // ─── 1. Ensure permissions exist ──────────────────────────────────────────
  const permissionDefs = [
    { name: 'users', children: ['users.view', 'users.create', 'users.update', 'users.delete'] },
    { name: 'drivers', children: ['drivers.view', 'drivers.create', 'drivers.update', 'drivers.delete', 'drivers.approve'] },
    { name: 'riders', children: ['riders.view', 'riders.create', 'riders.update', 'riders.delete'] },
    { name: 'roles', children: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'] },
    { name: 'rides', children: ['rides.view', 'rides.manage', 'rides.cancel', 'rides.assign'] },
    { name: 'settings', children: ['settings.view', 'settings.update'] },
    { name: 'wallets', children: ['wallets.view', 'wallets.manage', 'wallets.withdraw'] },
    { name: 'reports', children: ['reports.view', 'reports.export'] },
    { name: 'complaints', children: ['complaints.view', 'complaints.manage'] },
    { name: 'services', children: ['services.view', 'services.create', 'services.update', 'services.delete'] },
    { name: 'coupons', children: ['coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete'] },
    { name: 'documents', children: ['documents.view', 'documents.manage'] },
    { name: 'notifications', children: ['notifications.view', 'notifications.send'] },
  ]

  for (const def of permissionDefs) {
    const parent = await prisma.permission.upsert({
      where: { name_guardName: { name: def.name, guardName: 'web' } },
      update: {},
      create: { name: def.name, guardName: 'web' },
    })
    for (const childName of def.children) {
      await prisma.permission.upsert({
        where: { name_guardName: { name: childName, guardName: 'web' } },
        update: { parentId: parent.id },
        create: { name: childName, guardName: 'web', parentId: parent.id },
      })
    }
  }

  const allPerms = await prisma.permission.findMany()
  const permMap = Object.fromEntries(allPerms.map(p => [p.name, p.id]))
  console.log(`✅ ${allPerms.length} permissions ready`)

  // ─── 2. Ensure roles exist ────────────────────────────────────────────────
  const roleDefs = [
    {
      name: 'manager',
      permissions: [
        'users', 'users.view', 'users.create', 'users.update',
        'drivers', 'drivers.view', 'drivers.create', 'drivers.update', 'drivers.approve',
        'riders', 'riders.view', 'riders.update',
        'rides', 'rides.view', 'rides.manage', 'rides.cancel', 'rides.assign',
        'roles', 'roles.view',
        'wallets', 'wallets.view', 'wallets.manage', 'wallets.withdraw',
        'reports', 'reports.view', 'reports.export',
        'complaints', 'complaints.view', 'complaints.manage',
        'services', 'services.view', 'services.create', 'services.update',
        'coupons', 'coupons.view', 'coupons.create', 'coupons.update',
        'documents', 'documents.view', 'documents.manage',
        'notifications', 'notifications.view', 'notifications.send',
        'settings', 'settings.view',
      ],
    },
    {
      name: 'support',
      permissions: [
        'users', 'users.view',
        'drivers', 'drivers.view',
        'riders', 'riders.view',
        'rides', 'rides.view', 'rides.manage',
        'wallets', 'wallets.view',
        'complaints', 'complaints.view', 'complaints.manage',
        'documents', 'documents.view', 'documents.manage',
        'notifications', 'notifications.view', 'notifications.send',
      ],
    },
    {
      name: 'operations',
      permissions: [
        'drivers', 'drivers.view', 'drivers.update', 'drivers.approve',
        'rides', 'rides.view', 'rides.manage', 'rides.cancel', 'rides.assign',
        'wallets', 'wallets.view',
        'reports', 'reports.view',
        'complaints', 'complaints.view',
        'documents', 'documents.view', 'documents.manage',
      ],
    },
    {
      name: 'accountant',
      permissions: [
        'wallets', 'wallets.view', 'wallets.manage', 'wallets.withdraw',
        'reports', 'reports.view', 'reports.export',
        'rides', 'rides.view',
        'users', 'users.view',
        'drivers', 'drivers.view',
      ],
    },
  ]

  for (const roleDef of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name_guardName: { name: roleDef.name, guardName: 'web' } },
      update: {},
      create: { name: roleDef.name, guardName: 'web' },
    })

    for (const permName of roleDef.permissions) {
      const permId = permMap[permName]
      if (!permId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      })
    }
    console.log(`✅ Role "${roleDef.name}" → ${roleDef.permissions.length} permissions`)
  }

  // ─── 3. Create staff employees ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Staff@123', 10)

  const staffDefs = [
    {
      firstName: 'Khaled',
      lastName: 'Al-Mansour',
      email: 'khaled.manager@offergo.com',
      contactNumber: '+966551000001',
      userType: 'sub_admin',
      role: 'manager',
    },
    {
      firstName: 'Sara',
      lastName: 'Al-Harbi',
      email: 'sara.support@offergo.com',
      contactNumber: '+966551000002',
      userType: 'sub_admin',
      role: 'support',
    },
    {
      firstName: 'Omar',
      lastName: 'Al-Rashid',
      email: 'omar.ops@offergo.com',
      contactNumber: '+966551000003',
      userType: 'sub_admin',
      role: 'operations',
    },
    {
      firstName: 'Fatima',
      lastName: 'Al-Zahrani',
      email: 'fatima.finance@offergo.com',
      contactNumber: '+966551000004',
      userType: 'sub_admin',
      role: 'accountant',
    },
  ]

  for (const staffDef of staffDefs) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: staffDef.email }, { contactNumber: staffDef.contactNumber }] },
    })

    let user
    if (existing) {
      user = existing
      console.log(`⏩ Staff "${staffDef.firstName}" already exists (ID: ${user.id})`)
    } else {
      user = await prisma.user.create({
        data: {
          firstName: staffDef.firstName,
          lastName: staffDef.lastName,
          email: staffDef.email,
          contactNumber: staffDef.contactNumber,
          password: hashedPassword,
          userType: staffDef.userType,
          status: 'active',
          displayName: `${staffDef.firstName} ${staffDef.lastName}`,
          referralCode: `STF${Date.now()}${Math.floor(Math.random() * 100)}`,
          isVerified: true,
        },
      })
      console.log(`✅ Created staff "${staffDef.firstName} ${staffDef.lastName}" (ID: ${user.id})`)
    }

    const role = await prisma.role.findFirst({ where: { name: staffDef.role } })
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      })
      console.log(`   → Assigned role: "${staffDef.role}"`)
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════')
  console.log('  Staff Seeding Complete!')
  console.log('════════════════════════════════════════════')
  console.log('')
  console.log('  Staff accounts (password: Staff@123):')
  console.log('')
  for (const s of staffDefs) {
    console.log(`  📧 ${s.email}`)
    console.log(`     Role: ${s.role} | Phone: ${s.contactNumber}`)
    console.log('')
  }
  console.log('════════════════════════════════════════════')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
