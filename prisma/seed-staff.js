import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PERMISSION_TREE, flattenAllPermissionNames, ROLE_PRESETS } from './permissionCatalog.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Seeding staff employees with roles & permissions...\n')

  // ─── 1. Ensure all permissions exist (full dashboard catalog) ───────────
  for (const def of PERMISSION_TREE) {
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
  const permMap = Object.fromEntries(allPerms.map((p) => [p.name, p.id]))
  console.log(`✅ ${allPerms.length} permissions in catalog`)

  // ─── 2. Ensure roles exist with preset permission sets ────────────────────
  const allNames = flattenAllPermissionNames()
  const roleDefs = [
    { name: 'manager', permissions: allNames.filter((n) => permMap[n]) },
    { name: 'support', permissions: ROLE_PRESETS.support.filter((n) => permMap[n]) },
    { name: 'operations', permissions: ROLE_PRESETS.operations.filter((n) => permMap[n]) },
    { name: 'accountant', permissions: ROLE_PRESETS.accountant.filter((n) => permMap[n]) },
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
