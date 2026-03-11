import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔔 Seeding sample admin notifications...\n')

  const samples = [
    {
      type: 'new_driver',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Driver Registration',
        titleAr: 'تسجيل سائق جديد',
        message: 'Ahmed Mohamed registered and is pending approval.',
        messageAr: 'أحمد محمد سجّل حساب جديد وينتظر الموافقة.',
        link: '/drivers',
      },
      isRead: false,
    },
    {
      type: 'new_driver',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Driver Registration',
        titleAr: 'تسجيل سائق جديد',
        message: 'Khalid Ali registered via mobile and is pending approval.',
        messageAr: 'خالد علي سجّل عبر التطبيق وينتظر الموافقة.',
        link: '/drivers',
      },
      isRead: false,
    },
    {
      type: 'new_complaint',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Complaint Filed',
        titleAr: 'شكوى جديدة',
        message: 'Driver behavior complaint filed by rider.',
        messageAr: 'تم تقديم شكوى على سلوك السائق من قبل الراكب.',
        link: '/complaints',
      },
      isRead: false,
    },
    {
      type: 'new_withdrawal',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Withdrawal Request',
        titleAr: 'طلب سحب جديد',
        message: 'User #12 requested withdrawal of 500 SAR.',
        messageAr: 'المستخدم #12 طلب سحب 500 ر.س.',
        link: '/wallets',
      },
      isRead: false,
    },
    {
      type: 'new_ride',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Ride Request',
        titleAr: 'طلب رحلة جديد',
        message: 'Ride request from Riyadh City Center to King Fahd Airport.',
        messageAr: 'طلب رحلة من وسط الرياض إلى مطار الملك فهد.',
        link: '/ride-requests',
      },
      isRead: false,
    },
    {
      type: 'new_user',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New User Signed Up',
        titleAr: 'مستخدم جديد',
        message: 'A new rider signed up: Sara Ahmed.',
        messageAr: 'مستخدم جديد سجّل: سارة أحمد.',
        link: '/riders',
      },
      isRead: true,
    },
    {
      type: 'new_complaint',
      notifiableType: 'Admin',
      notifiableId: 0,
      data: {
        title: 'New Complaint Filed',
        titleAr: 'شكوى جديدة',
        message: 'Payment issue complaint from user.',
        messageAr: 'شكوى بخصوص مشكلة في الدفع من المستخدم.',
        link: '/complaints',
      },
      isRead: true,
    },
  ]

  for (const sample of samples) {
    await prisma.notification.create({ data: sample })
  }

  console.log(`✅ Created ${samples.length} admin notifications`)

  const count = await prisma.notification.count({ where: { notifiableType: 'Admin' } })
  console.log(`📊 Total admin notifications in DB: ${count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
