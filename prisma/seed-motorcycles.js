import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏍️  Seeding Scooter & Motorcycle categories...\n')

  // ─── 1. Upsert the Service Category ────────────────────────────────────────
  let motorCategory = await prisma.serviceCategory.findFirst({
    where: { slug: 'motorcycle-transport' },
  })

  if (!motorCategory) {
    motorCategory = await prisma.serviceCategory.create({
      data: {
        name: 'Motorcycle & Scooter',
        nameAr: 'دراجات نارية وسكوتر',
        slug: 'motorcycle-transport',
        description: 'Fast two-wheeler transport for passengers and small deliveries',
        descriptionAr: 'خدمات نقل سريعة بالدراجات النارية والسكوتر للركاب والتوصيل',
        icon: '🏍️',
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        status: 1,
      },
    })
    console.log(`✅ Created service category: ${motorCategory.name} (id: ${motorCategory.id})`)
  } else {
    console.log(`⏭️  Service category already exists: ${motorCategory.name} (id: ${motorCategory.id})`)
  }

  // ─── 2. Vehicle Categories ─────────────────────────────────────────────────
  const vehicleDefs = [
    {
      slug: 'scooter',
      name: 'Scooter',
      nameAr: 'سكوتر',
      description: 'Compact electric or petrol scooter for quick city rides',
      descriptionAr: 'سكوتر كهربائي أو بنزين صغير للتنقل السريع داخل المدينة',
      icon: '🛵',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      capacity: 1,
      baseFare: 5.0,
      baseDistance: 3.0,
      pricePerKm: 1.5,
      pricePerMin: 0.3,
      minFare: 5.0,
      features: [
        { name: 'Helmet Provided', nameAr: 'خوذة متوفرة' },
        { name: 'Phone Holder', nameAr: 'حامل هاتف' },
        { name: 'Small Storage', nameAr: 'تخزين صغير' },
      ],
    },
    {
      slug: 'electric-scooter',
      name: 'Electric Scooter',
      nameAr: 'سكوتر كهربائي',
      description: 'Eco-friendly electric scooter for green transportation',
      descriptionAr: 'سكوتر كهربائي صديق للبيئة للتنقل الأخضر',
      icon: '⚡',
      image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800',
      capacity: 1,
      baseFare: 4.0,
      baseDistance: 3.0,
      pricePerKm: 1.2,
      pricePerMin: 0.25,
      minFare: 4.0,
      features: [
        { name: 'Zero Emission', nameAr: 'صفر انبعاثات' },
        { name: 'Helmet Provided', nameAr: 'خوذة متوفرة' },
        { name: 'Quiet Ride', nameAr: 'رحلة هادئة' },
      ],
    },
    {
      slug: 'motorcycle-standard',
      name: 'Motorcycle (Standard)',
      nameAr: 'دراجة نارية (عادية)',
      description: 'Standard motorcycle for everyday commuting',
      descriptionAr: 'دراجة نارية عادية للتنقل اليومي',
      icon: '🏍️',
      image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800',
      capacity: 1,
      baseFare: 7.0,
      baseDistance: 5.0,
      pricePerKm: 2.0,
      pricePerMin: 0.4,
      minFare: 7.0,
      features: [
        { name: 'Two Helmets', nameAr: 'خوذتان' },
        { name: 'Phone Charger', nameAr: 'شاحن هاتف' },
        { name: 'Medium Storage', nameAr: 'تخزين متوسط' },
      ],
    },
    {
      slug: 'motorcycle-sport',
      name: 'Motorcycle (Sport)',
      nameAr: 'دراجة نارية (رياضية)',
      description: 'Sport motorcycle for fast inter-city rides',
      descriptionAr: 'دراجة نارية رياضية للتنقل السريع بين المناطق',
      icon: '🏎️',
      image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
      capacity: 1,
      baseFare: 12.0,
      baseDistance: 5.0,
      pricePerKm: 3.0,
      pricePerMin: 0.5,
      minFare: 12.0,
      features: [
        { name: 'High-Speed', nameAr: 'سرعة عالية' },
        { name: 'Aerodynamic Design', nameAr: 'تصميم ديناميكي' },
        { name: 'Premium Helmets', nameAr: 'خوذ مميزة' },
      ],
    },
    {
      slug: 'motorcycle-cruiser',
      name: 'Motorcycle (Cruiser)',
      nameAr: 'دراجة نارية (كروزر)',
      description: 'Comfortable cruiser motorcycle for long-distance rides',
      descriptionAr: 'دراجة نارية كروزر مريحة للرحلات الطويلة',
      icon: '🛣️',
      image: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800',
      capacity: 1,
      baseFare: 15.0,
      baseDistance: 5.0,
      pricePerKm: 3.5,
      pricePerMin: 0.6,
      minFare: 15.0,
      features: [
        { name: 'Comfortable Seat', nameAr: 'مقعد مريح' },
        { name: 'Luggage Rack', nameAr: 'حامل أمتعة' },
        { name: 'Windshield', nameAr: 'حاجب ريح' },
      ],
    },
    {
      slug: 'motorcycle-delivery',
      name: 'Motorcycle (Delivery)',
      nameAr: 'دراجة نارية (توصيل)',
      description: 'Delivery motorcycle with cargo box for parcels and food delivery',
      descriptionAr: 'دراجة نارية للتوصيل مع صندوق حمل للطرود وتوصيل الطعام',
      icon: '📦',
      image: 'https://images.unsplash.com/photo-1616455579100-2ceaa4eb2d37?w=800',
      capacity: 0,
      maxLoad: 50.0,
      baseFare: 6.0,
      baseDistance: 3.0,
      pricePerKm: 1.8,
      pricePerMin: 0.3,
      minFare: 6.0,
      features: [
        { name: 'Insulated Box', nameAr: 'صندوق معزول' },
        { name: 'GPS Tracking', nameAr: 'تتبع GPS' },
        { name: '50kg Capacity', nameAr: 'سعة 50 كجم' },
      ],
    },
    {
      slug: 'trike',
      name: 'Three-Wheeler (Tuk-Tuk)',
      nameAr: 'توك توك (ثلاث عجلات)',
      description: 'Three-wheeled vehicle for short trips and narrow streets',
      descriptionAr: 'مركبة ثلاثية العجلات للرحلات القصيرة والشوارع الضيقة',
      icon: '🛺',
      image: 'https://images.unsplash.com/photo-1612810436757-81a18961a96c?w=800',
      capacity: 2,
      baseFare: 5.0,
      baseDistance: 3.0,
      pricePerKm: 1.5,
      pricePerMin: 0.3,
      minFare: 5.0,
      features: [
        { name: 'Rain Cover', nameAr: 'غطاء للمطر' },
        { name: 'Two Passengers', nameAr: 'راكبان' },
        { name: 'Budget Friendly', nameAr: 'اقتصادي' },
      ],
    },
  ]

  let created = 0
  let skipped = 0

  for (const def of vehicleDefs) {
    const existing = await prisma.vehicleCategory.findFirst({ where: { slug: def.slug } })
    if (existing) {
      console.log(`⏭️  Vehicle category already exists: ${def.name}`)
      skipped++
      continue
    }

    const vc = await prisma.vehicleCategory.create({
      data: {
        serviceCategoryId: motorCategory.id,
        name: def.name,
        nameAr: def.nameAr,
        slug: def.slug,
        description: def.description,
        descriptionAr: def.descriptionAr,
        icon: def.icon,
        image: def.image,
        capacity: def.capacity ?? null,
        maxLoad: def.maxLoad ?? null,
        status: 1,
      },
    })
    console.log(`  ✅ Created: ${vc.name} (id: ${vc.id})`)

    // Features
    for (const feat of def.features) {
      await prisma.categoryFeature.create({
        data: {
          vehicleCategoryId: vc.id,
          name: feat.name,
          nameAr: feat.nameAr,
          status: 1,
        },
      })
    }

    // Pricing Rule
    await prisma.pricingRule.create({
      data: {
        vehicleCategoryId: vc.id,
        baseFare: def.baseFare,
        baseDistance: def.baseDistance,
        perDistanceAfterBase: def.pricePerKm,
        perMinuteDrive: def.pricePerMin,
        perMinuteWait: 0.2,
        waitingTimeLimit: 5.0,
        minimumFare: def.minFare,
        cancellationFee: 3.0,
        commissionType: 'percentage',
        adminCommission: 15.0,
        fleetCommission: 5.0,
        status: 1,
      },
    })

    created++
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} already existed`)
  console.log('🏍️  Motorcycle & scooter seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
