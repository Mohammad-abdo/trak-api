import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing data...')
  await prisma.rideRequestRating.deleteMany()
  await prisma.rideRequestBid.deleteMany()
  await prisma.complaintComment.deleteMany()
  await prisma.complaint.deleteMany()
  await prisma.driverDocument.deleteMany()
  await prisma.document.deleteMany()
  await prisma.walletHistory.deleteMany()
  await prisma.wallet.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.rideRequest.deleteMany()
  await prisma.userBankAccount.deleteMany()
  await prisma.userDetail.deleteMany()
  await prisma.driverService.deleteMany()
  await prisma.user.deleteMany()
  await prisma.coupon.deleteMany()
  await prisma.service.deleteMany()
  await prisma.region.deleteMany()
  await prisma.faq.deleteMany()
  await prisma.cancellation.deleteMany()
  await prisma.additionalFees.deleteMany()
  await prisma.sos.deleteMany()
  await prisma.pages.deleteMany()
  await prisma.frontendData.deleteMany()

  // Create Regions
  console.log('Creating regions...')
  const region1 = await prisma.region.create({
    data: {
      name: 'Downtown',
      nameAr: 'وسط البلد',
      distanceUnit: 'km',
      status: 1,
      timezone: 'UTC',
      coordinates: { lat: 24.7136, lng: 46.6753 }
    }
  })

  const region2 = await prisma.region.create({
    data: {
      name: 'North District',
      nameAr: 'المنطقة الشمالية',
      distanceUnit: 'km',
      status: 1,
      timezone: 'UTC',
      coordinates: { lat: 24.8, lng: 46.7 }
    }
  })

  // Create Services
  console.log('Creating services...')
  const service1 = await prisma.service.create({
    data: {
      name: 'Economy',
      nameAr: 'اقتصادي',
      regionId: region1.id,
      capacity: 4,
      baseFare: 10.0,
      minimumFare: 15.0,
      minimumDistance: 2.0,
      perDistance: 2.5,
      perMinuteDrive: 0.5,
      perMinuteWait: 0.3,
      waitingTimeLimit: 5.0,
      paymentMethod: 'cash,card',
      commissionType: 'percentage',
      adminCommission: 15.0,
      fleetCommission: 5.0,
      status: 1,
      cancellationFee: 5.0,
      description: 'Affordable ride for everyday travel',
      descriptionAr: 'رحلة اقتصادية للسفر اليومي'
    }
  })

  const service2 = await prisma.service.create({
    data: {
      name: 'Premium',
      nameAr: 'مميز',
      regionId: region1.id,
      capacity: 4,
      baseFare: 20.0,
      minimumFare: 30.0,
      minimumDistance: 2.0,
      perDistance: 4.0,
      perMinuteDrive: 1.0,
      perMinuteWait: 0.5,
      waitingTimeLimit: 5.0,
      paymentMethod: 'cash,card',
      commissionType: 'percentage',
      adminCommission: 20.0,
      fleetCommission: 10.0,
      status: 1,
      cancellationFee: 10.0,
      description: 'Premium comfort and luxury ride',
      descriptionAr: 'رحلة مريحة وفاخرة'
    }
  })

  const service3 = await prisma.service.create({
    data: {
      name: 'XL',
      nameAr: 'كبير',
      regionId: region2.id,
      capacity: 7,
      baseFare: 25.0,
      minimumFare: 35.0,
      minimumDistance: 2.0,
      perDistance: 5.0,
      perMinuteDrive: 1.2,
      perMinuteWait: 0.6,
      waitingTimeLimit: 5.0,
      paymentMethod: 'cash,card',
      commissionType: 'percentage',
      adminCommission: 18.0,
      fleetCommission: 8.0,
      status: 1,
      cancellationFee: 12.0,
      description: 'Large vehicle for groups',
      descriptionAr: 'مركبة كبيرة للمجموعات'
    }
  })

  // Hash password for users
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Create Admin User
  console.log('Creating admin user...')
  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@alaelsareea.com',
      username: 'admin',
      password: hashedPassword,
      contactNumber: '+966501234567',
      userType: 'admin',
      status: 'active',
      displayName: 'Admin User',
      address: 'Admin Office, Downtown',
      isOnline: true,
      isAvailable: true
    }
  })

  // Create Fleet User
  console.log('Creating fleet user...')
  const fleet = await prisma.user.create({
    data: {
      firstName: 'Fleet',
      lastName: 'Manager',
      email: 'fleet@alaelsareea.com',
      username: 'fleet1',
      password: hashedPassword,
      contactNumber: '+966501234568',
      userType: 'fleet',
      status: 'active',
      displayName: 'Fleet Manager',
      address: 'Fleet Office, North District',
      isOnline: true,
      isAvailable: true
    }
  })

  // Create Riders
  console.log('Creating riders...')
  const rider1 = await prisma.user.create({
    data: {
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      username: 'ahmed_ali',
      password: hashedPassword,
      contactNumber: '+966501111111',
      userType: 'rider',
      status: 'active',
      displayName: 'Ahmed Ali',
      address: '123 Main Street, Downtown',
      latitude: '24.7136',
      longitude: '46.6753',
      isOnline: false,
      isAvailable: false
    }
  })

  const rider2 = await prisma.user.create({
    data: {
      firstName: 'Fatima',
      lastName: 'Hassan',
      email: 'fatima@example.com',
      username: 'fatima_hassan',
      password: hashedPassword,
      contactNumber: '+966502222222',
      userType: 'rider',
      status: 'active',
      displayName: 'Fatima Hassan',
      address: '456 Park Avenue, North District',
      latitude: '24.8',
      longitude: '46.7',
      isOnline: false,
      isAvailable: false
    }
  })

  const rider3 = await prisma.user.create({
    data: {
      firstName: 'Mohammed',
      lastName: 'Omar',
      email: 'mohammed@example.com',
      username: 'mohammed_omar',
      password: hashedPassword,
      contactNumber: '+966503333333',
      userType: 'rider',
      status: 'active',
      displayName: 'Mohammed Omar',
      address: '789 Business District',
      latitude: '24.75',
      longitude: '46.68',
      isOnline: false,
      isAvailable: false
    }
  })

  // Create Drivers
  console.log('Creating drivers...')
  const driver1 = await prisma.user.create({
    data: {
      firstName: 'Khalid',
      lastName: 'Ibrahim',
      email: 'khalid@example.com',
      username: 'khalid_ibrahim',
      password: hashedPassword,
      contactNumber: '+966504444444',
      userType: 'driver',
      status: 'active',
      displayName: 'Khalid Ibrahim',
      address: 'Driver Residence 1',
      latitude: '24.72',
      longitude: '46.67',
      serviceId: service1.id,
      fleetId: fleet.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date()
    }
  })

  const driver2 = await prisma.user.create({
    data: {
      firstName: 'Sara',
      lastName: 'Ahmed',
      email: 'sara@example.com',
      username: 'sara_ahmed',
      password: hashedPassword,
      contactNumber: '+966505555555',
      userType: 'driver',
      status: 'active',
      displayName: 'Sara Ahmed',
      address: 'Driver Residence 2',
      latitude: '24.78',
      longitude: '46.72',
      serviceId: service2.id,
      fleetId: fleet.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date()
    }
  })

  const driver3 = await prisma.user.create({
    data: {
      firstName: 'Omar',
      lastName: 'Youssef',
      email: 'omar@example.com',
      username: 'omar_youssef',
      password: hashedPassword,
      contactNumber: '+966506666666',
      userType: 'driver',
      status: 'pending',
      displayName: 'Omar Youssef',
      address: 'Driver Residence 3',
      latitude: '24.76',
      longitude: '46.69',
      serviceId: service3.id,
      isOnline: false,
      isAvailable: false,
      isVerifiedDriver: false
    }
  })

  // Create User Details for Drivers
  console.log('Creating driver details...')
  await prisma.userDetail.create({
    data: {
      userId: driver1.id,
      carModel: 'Toyota Camry',
      carColor: 'White',
      carPlateNumber: 'ABC-1234',
      carProductionYear: 2022,
      workAddress: 'Downtown Area',
      homeAddress: 'Driver Residence 1',
      workLatitude: '24.7136',
      workLongitude: '46.6753',
      homeLatitude: '24.72',
      homeLongitude: '46.67'
    }
  })

  await prisma.userDetail.create({
    data: {
      userId: driver2.id,
      carModel: 'Honda Accord',
      carColor: 'Black',
      carPlateNumber: 'XYZ-5678',
      carProductionYear: 2023,
      workAddress: 'North District',
      homeAddress: 'Driver Residence 2',
      workLatitude: '24.8',
      workLongitude: '46.7',
      homeLatitude: '24.78',
      homeLongitude: '46.72'
    }
  })

  // Create Bank Accounts for Drivers
  console.log('Creating bank accounts...')
  await prisma.userBankAccount.create({
    data: {
      userId: driver1.id,
      bankName: 'Saudi National Bank',
      bankCode: 'SNB',
      accountHolderName: 'Khalid Ibrahim',
      accountNumber: '1234567890',
      bankAddress: 'Riyadh, Saudi Arabia',
      routingNumber: '123456',
      bankIban: 'SA1234567890123456789012',
      bankSwift: 'SNBASAJE'
    }
  })

  await prisma.userBankAccount.create({
    data: {
      userId: driver2.id,
      bankName: 'Al Rajhi Bank',
      bankCode: 'ARB',
      accountHolderName: 'Sara Ahmed',
      accountNumber: '9876543210',
      bankAddress: 'Riyadh, Saudi Arabia',
      routingNumber: '654321',
      bankIban: 'SA9876543210987654321098',
      bankSwift: 'RJHISARI'
    }
  })

  // Create Wallets
  console.log('Creating wallets...')
  await prisma.wallet.create({
    data: {
      userId: rider1.id,
      balance: 500.0,
      currency: 'SAR'
    }
  })

  await prisma.wallet.create({
    data: {
      userId: driver1.id,
      balance: 2500.0,
      currency: 'SAR'
    }
  })

  await prisma.wallet.create({
    data: {
      userId: driver2.id,
      balance: 1800.0,
      currency: 'SAR'
    }
  })

  // Create Documents
  console.log('Creating documents...')
  const doc1 = await prisma.document.create({
    data: {
      name: 'Driver License',
      nameAr: 'رخصة القيادة',
      type: 'license',
      status: 1,
      isRequired: true,
      hasExpiryDate: true
    }
  })

  const doc2 = await prisma.document.create({
    data: {
      name: 'Vehicle Registration',
      nameAr: 'رخصة المركبة',
      type: 'registration',
      status: 1,
      isRequired: true,
      hasExpiryDate: true
    }
  })

  const doc3 = await prisma.document.create({
    data: {
      name: 'Insurance Certificate',
      nameAr: 'شهادة التأمين',
      type: 'insurance',
      status: 1,
      isRequired: true,
      hasExpiryDate: true
    }
  })

  const doc4 = await prisma.document.create({
    data: {
      name: 'ID Card',
      nameAr: 'بطاقة الهوية',
      type: 'id',
      status: 1,
      isRequired: true,
      hasExpiryDate: false
    }
  })

  // Create Driver Documents
  console.log('Creating driver documents...')
  await prisma.driverDocument.create({
    data: {
      driverId: driver1.id,
      documentId: doc1.id,
      isVerified: true,
      expireDate: new Date('2025-12-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driverId: driver1.id,
      documentId: doc2.id,
      isVerified: true,
      expireDate: new Date('2025-06-30')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driverId: driver1.id,
      documentId: doc3.id,
      isVerified: true,
      expireDate: new Date('2025-03-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driverId: driver2.id,
      documentId: doc1.id,
      isVerified: true,
      expireDate: new Date('2026-01-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driverId: driver2.id,
      documentId: doc2.id,
      isVerified: true,
      expireDate: new Date('2025-08-31')
    }
  })

  // Create Coupons
  console.log('Creating coupons...')
  await prisma.coupon.create({
    data: {
      code: 'WELCOME10',
      title: 'Welcome Discount',
      titleAr: 'خصم الترحيب',
      couponType: 'first_ride',
      usageLimitPerRider: 1,
      discountType: 'percentage',
      discount: 10.0,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      minimumAmount: 20.0,
      maximumDiscount: 50.0,
      status: 1,
      description: '10% off on your first ride',
      descriptionAr: 'خصم 10% على أول رحلة لك',
      serviceIds: JSON.stringify([service1.id, service2.id]),
      regionIds: JSON.stringify([region1.id])
    }
  })

  await prisma.coupon.create({
    data: {
      code: 'SAVE20',
      title: 'Save 20 SAR',
      titleAr: 'وفر 20 ريال',
      couponType: 'all',
      usageLimitPerRider: 5,
      discountType: 'fixed',
      discount: 20.0,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      minimumAmount: 50.0,
      maximumDiscount: 20.0,
      status: 1,
      description: 'Save 20 SAR on rides above 50 SAR',
      descriptionAr: 'وفر 20 ريال على الرحلات فوق 50 ريال',
      serviceIds: JSON.stringify([service1.id, service2.id, service3.id]),
      regionIds: JSON.stringify([region1.id, region2.id])
    }
  })

  await prisma.coupon.create({
    data: {
      code: 'WEEKEND15',
      title: 'Weekend Special',
      titleAr: 'عرض نهاية الأسبوع',
      couponType: 'all',
      usageLimitPerRider: 3,
      discountType: 'percentage',
      discount: 15.0,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      minimumAmount: 30.0,
      maximumDiscount: 100.0,
      status: 1,
      description: '15% off on weekends',
      descriptionAr: 'خصم 15% في عطلة نهاية الأسبوع',
      serviceIds: JSON.stringify([service2.id, service3.id]),
      regionIds: JSON.stringify([region1.id, region2.id])
    }
  })

  // Create FAQs
  console.log('Creating FAQs...')
  await prisma.faq.create({
    data: {
      question: 'How do I book a ride?',
      questionAr: 'كيف أحجز رحلة؟',
      answer: 'You can book a ride through our mobile app or website. Simply enter your pickup and destination locations.',
      answerAr: 'يمكنك حجز رحلة من خلال تطبيقنا أو موقعنا. ما عليك سوى إدخال مواقع الالتقاء والوجهة.',
      type: 'rider'
    }
  })

  await prisma.faq.create({
    data: {
      question: 'What payment methods are accepted?',
      questionAr: 'ما هي طرق الدفع المقبولة؟',
      answer: 'We accept cash, credit cards, and digital wallets.',
      answerAr: 'نقبل النقد وبطاقات الائتمان والمحافظ الرقمية.',
      type: 'rider'
    }
  })

  await prisma.faq.create({
    data: {
      question: 'How do I become a driver?',
      questionAr: 'كيف أصبح سائقًا؟',
      answer: 'Download our driver app, complete the registration, and submit required documents for verification.',
      answerAr: 'قم بتنزيل تطبيق السائق الخاص بنا، وأكمل التسجيل، وأرسل المستندات المطلوبة للتحقق.',
      type: 'driver'
    }
  })

  await prisma.faq.create({
    data: {
      question: 'What documents do I need?',
      questionAr: 'ما هي المستندات التي أحتاجها؟',
      answer: 'You need a valid driver license, vehicle registration, and insurance certificate.',
      answerAr: 'تحتاج إلى رخصة قيادة سارية، وتسجيل المركبة، وشهادة التأمين.',
      type: 'driver'
    }
  })

  // Create Cancellations
  console.log('Creating cancellations...')
  await prisma.cancellation.create({
    data: {
      name: 'Driver not responding',
      nameAr: 'السائق لا يستجيب',
      type: 'rider',
      status: 1
    }
  })

  await prisma.cancellation.create({
    data: {
      name: 'Rider not available',
      nameAr: 'الراكب غير متاح',
      type: 'driver',
      status: 1
    }
  })

  await prisma.cancellation.create({
    data: {
      name: 'Wrong address',
      nameAr: 'عنوان خاطئ',
      type: 'rider',
      status: 1
    }
  })

  await prisma.cancellation.create({
    data: {
      name: 'Change of plans',
      nameAr: 'تغيير في الخطط',
      type: 'rider',
      status: 1
    }
  })

  // Create Additional Fees
  console.log('Creating additional fees...')
  await prisma.additionalFees.create({
    data: {
      title: 'Airport Fee',
      titleAr: 'رسوم المطار',
      status: 1
    }
  })

  await prisma.additionalFees.create({
    data: {
      title: 'Toll Fee',
      titleAr: 'رسوم الطريق',
      status: 1
    }
  })

  await prisma.additionalFees.create({
    data: {
      title: 'Night Surcharge',
      titleAr: 'رسوم الليل',
      status: 1
    }
  })

  // Create SOS
  console.log('Creating SOS contacts...')
  await prisma.sos.create({
    data: {
      userId: rider1.id,
      name: 'Emergency Contact',
      nameAr: 'جهة اتصال طوارئ',
      contactNumber: '+966991234567',
      status: 1
    }
  })

  await prisma.sos.create({
    data: {
      userId: rider2.id,
      name: 'Family Contact',
      nameAr: 'جهة اتصال عائلية',
      contactNumber: '+966992345678',
      status: 1
    }
  })

  // Create Pages
  console.log('Creating pages...')
  await prisma.pages.create({
    data: {
      title: 'About Us',
      titleAr: 'من نحن',
      description: 'Learn more about Tovo and our mission to provide safe and reliable transportation.',
      descriptionAr: 'تعرف على المزيد حول على السريع ومهمتنا في توفير النقل الآمن والموثوق.',
      slug: 'about-us',
      status: 1
    }
  })

  await prisma.pages.create({
    data: {
      title: 'Terms and Conditions',
      titleAr: 'الشروط والأحكام',
      description: 'Read our terms and conditions for using our service.',
      descriptionAr: 'اقرأ الشروط والأحكام الخاصة باستخدام خدمتنا.',
      slug: 'terms-conditions',
      status: 1
    }
  })

  await prisma.pages.create({
    data: {
      title: 'Privacy Policy',
      titleAr: 'سياسة الخصوصية',
      description: 'Our privacy policy explains how we collect and use your data.',
      descriptionAr: 'توضح سياسة الخصوصية الخاصة بنا كيفية جمع بياناتك واستخدامها.',
      slug: 'privacy-policy',
      status: 1
    }
  })

  // Create Frontend Data
  console.log('Creating frontend data...')
  await prisma.frontendData.create({
    data: {
      title: 'Welcome to Tovo',
      titleAr: 'مرحبًا بك في على السريع',
      subtitle: 'Your trusted ride-hailing service',
      subtitleAr: 'خدمة النقل الموثوقة',
      type: 'hero',
      description: 'Book a ride in minutes and travel safely to your destination.',
      descriptionAr: 'احجز رحلة في دقائق وسافر بأمان إلى وجهتك.'
    }
  })

  await prisma.frontendData.create({
    data: {
      title: 'Why Choose Us?',
      titleAr: 'لماذا تختارنا؟',
      subtitle: 'Safe, Fast, and Reliable',
      subtitleAr: 'آمن وسريع وموثوق',
      type: 'features',
      description: 'We provide the best transportation experience with verified drivers and modern vehicles.',
      descriptionAr: 'نوفر أفضل تجربة نقل مع سائقين معتمدين ومركبات حديثة.'
    }
  })

  // Create Ride Requests
  console.log('Creating ride requests...')
  const ride1 = await prisma.rideRequest.create({
    data: {
      riderId: rider1.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 25.50,
      surgeAmount: 0,
      subtotal: 25.50,
      extraChargesAmount: 0,
      driverId: driver1.id,
      startLatitude: '24.7136',
      startLongitude: '46.6753',
      startAddress: '123 Main Street, Downtown',
      endLatitude: '24.8',
      endLongitude: '46.7',
      endAddress: '456 Park Avenue, North District',
      distance: 12.5,
      duration: 20,
      seatCount: 1,
      status: 'completed',
      rideHasBid: false,
      baseFare: 10.0,
      minimumFare: 15.0,
      perDistance: 2.5,
      perDistanceCharge: 25.0,
      perMinuteDrive: 0.5,
      perMinuteDriveCharge: 10.0,
      paymentType: 'cash',
      tips: 5.0,
      isRiderRated: true,
      isDriverRated: true
    }
  })

  const ride2 = await prisma.rideRequest.create({
    data: {
      riderId: rider2.id,
      serviceId: service2.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 45.0,
      surgeAmount: 0,
      subtotal: 45.0,
      extraChargesAmount: 0,
      driverId: driver2.id,
      startLatitude: '24.8',
      startLongitude: '46.7',
      startAddress: '456 Park Avenue, North District',
      endLatitude: '24.75',
      endLongitude: '46.68',
      endAddress: '789 Business District',
      distance: 8.0,
      duration: 15,
      seatCount: 2,
      status: 'in_progress',
      rideHasBid: false,
      baseFare: 20.0,
      minimumFare: 30.0,
      perDistance: 4.0,
      perDistanceCharge: 32.0,
      perMinuteDrive: 1.0,
      perMinuteDriveCharge: 15.0,
      paymentType: 'card',
      isRiderRated: false,
      isDriverRated: false
    }
  })

  const ride3 = await prisma.rideRequest.create({
    data: {
      riderId: rider3.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: true,
      scheduleDatetime: new Date(Date.now() + 86400000), // Tomorrow
      rideAttempt: 0,
      distanceUnit: 'km',
      totalAmount: 0,
      surgeAmount: 0,
      subtotal: 0,
      extraChargesAmount: 0,
      startLatitude: '24.75',
      startLongitude: '46.68',
      startAddress: '789 Business District',
      endLatitude: '24.72',
      endLongitude: '46.67',
      endAddress: 'Airport Terminal',
      distance: 15.0,
      duration: 25,
      seatCount: 1,
      status: 'pending',
      rideHasBid: false,
      baseFare: 10.0,
      minimumFare: 15.0,
      perDistance: 2.5,
      perMinuteDrive: 0.5,
      paymentType: 'cash',
      isRiderRated: false,
      isDriverRated: false
    }
  })

  // Create Payments
  console.log('Creating payments...')
  await prisma.payment.create({
    data: {
      rideRequestId: ride1.id,
      userId: rider1.id,
      driverId: driver1.id,
      amount: 25.50,
      paymentType: 'cash',
      paymentStatus: 'completed',
      paymentDate: new Date()
    }
  })

  // Create Ratings
  console.log('Creating ratings...')
  await prisma.rideRequestRating.create({
    data: {
      rideRequestId: ride1.id,
      riderId: rider1.id,
      driverId: driver1.id,
      rating: 5,
      comment: 'Excellent service!',
      ratingBy: 'rider'
    }
  })

  await prisma.rideRequestRating.create({
    data: {
      rideRequestId: ride1.id,
      riderId: rider1.id,
      driverId: driver1.id,
      rating: 5,
      comment: 'Great passenger!',
      ratingBy: 'driver'
    }
  })

  // Create Complaints
  console.log('Creating complaints...')
  await prisma.complaint.create({
    data: {
      riderId: rider2.id,
      complaintBy: 'rider',
      subject: 'Late arrival',
      description: 'The driver arrived 15 minutes late.',
      rideRequestId: ride2.id,
      status: 'pending'
    }
  })

  // Create Driver Services
  console.log('Creating driver services...')
  await prisma.driverService.create({
    data: {
      driverId: driver1.id,
      serviceId: service1.id,
      status: 1
    }
  })

  await prisma.driverService.create({
    data: {
      driverId: driver2.id,
      serviceId: service2.id,
      status: 1
    }
  })

  console.log('✅ Database seed completed successfully!')
  console.log('')
  console.log('📊 Summary:')
  console.log(`   - Regions: 2`)
  console.log(`   - Services: 3`)
  console.log(`   - Users: 7 (1 admin, 1 fleet, 3 riders, 3 drivers)`)
  console.log(`   - Documents: 4`)
  console.log(`   - Coupons: 3`)
  console.log(`   - FAQs: 4`)
  console.log(`   - Ride Requests: 3`)
  console.log(`   - Payments: 1`)
  console.log(`   - Ratings: 2`)
  console.log(`   - Complaints: 1`)

  // ===================================
  // Multi-Service Platform Data
  // ===================================

  // Create Service Categories
  console.log('Creating service categories...')
  const passengerCategory = await prisma.serviceCategory.create({
    data: {
      name: 'Passenger Transport',
      nameAr: 'نقل ركاب',
      slug: 'passenger-transport',
      description: 'Transport services for passengers',
      descriptionAr: 'خدمات نقل للركاب',
      icon: '🚗',
      status: 1
    }
  })

  const cargoCategory = await prisma.serviceCategory.create({
    data: {
      name: 'Cargo Transport',
      nameAr: 'نقل بضائع',
      slug: 'cargo-transport',
      description: 'Transport services for goods and cargo',
      descriptionAr: 'خدمات نقل للبضائع والحمولات',
      icon: '🚚',
      status: 1
    }
  })

  const additionalCategory = await prisma.serviceCategory.create({
    data: {
      name: 'Additional Services',
      nameAr: 'خدمات إضافية',
      slug: 'additional-services',
      description: 'Other transport services',
      descriptionAr: 'خدمات نقل أخرى',
      icon: '🛴',
      status: 1
    }
  })

  // Create Vehicle Categories for Passenger Transport
  console.log('Creating vehicle categories for passengers...')
  const regularCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: passengerCategory.id,
      name: 'Regular',
      nameAr: 'عادية',
      slug: 'regular',
      description: 'Standard economical passenger vehicles',
      descriptionAr: 'مركبات ركاب اقتصادية قياسية',
      icon: '🚗',
      capacity: 4,
      status: 1
    }
  })

  const mediumCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: passengerCategory.id,
      name: 'Medium',
      nameAr: 'متوسطة',
      slug: 'medium',
      description: 'Mid-range comfort passenger vehicles',
      descriptionAr: 'مركبات ركاب متوسطة المدى',
      icon: '🚙',
      capacity: 4,
      status: 1
    }
  })

  const vipCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: passengerCategory.id,
      name: 'VIP',
      nameAr: 'VIP',
      slug: 'vip',
      description: 'Luxury premium passenger vehicles',
      descriptionAr: 'مركبات ركاب فاخرة ومميزة',
      icon: '✨',
      capacity: 4,
      status: 1
    }
  })

  // Create Vehicle Categories for Cargo Transport
  console.log('Creating vehicle categories for cargo...')
  const suzukiCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: cargoCategory.id,
      name: 'Suzuki',
      nameAr: 'سوزوكي',
      slug: 'suzuki',
      description: 'Small cargo transport vehicles',
      descriptionAr: 'مركبات نقل حمولات صغيرة',
      icon: '🚐',
      capacity: 2,
      maxLoad: 500,
      status: 1
    }
  })

  const quarterTruckCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: cargoCategory.id,
      name: 'Quarter Truck',
      nameAr: 'ربع نقل',
      slug: 'quarter-truck',
      description: 'Medium cargo transport vehicles',
      descriptionAr: 'مركبات نقل حمولات متوسطة',
      icon: '🚚',
      capacity: 2,
      maxLoad: 1000,
      status: 1
    }
  })

  const quarterTruck3TonCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: cargoCategory.id,
      name: 'Quarter Truck (3 Ton)',
      nameAr: 'ربع نقل (3 أطنان)',
      slug: 'quarter-truck-3ton',
      description: 'Large cargo transport vehicles (3 ton capacity)',
      descriptionAr: 'مركبات نقل حمولات كبيرة (3 أطنان)',
      icon: '🚛',
      capacity: 2,
      maxLoad: 3000,
      status: 1
    }
  })

  const jumboCategory = await prisma.vehicleCategory.create({
    data: {
      serviceCategoryId: cargoCategory.id,
      name: 'Jumbo',
      nameAr: 'جامبو',
      slug: 'jumbo',
      description: 'Extra-large cargo transport vehicles',
      descriptionAr: 'مركبات نقل حمولات كبيرة جداً',
      icon: '🚛',
      capacity: 2,
      maxLoad: 5000,
      status: 1
    }
  })

  // Create Category Features for Passenger Vehicles
  console.log('Creating category features...')
  const featureSets = {
    regular: ['Air Conditioning', 'GPS Navigation', 'Music System'],
    regularAr: ['تكييف هواء', 'نظام ملاحة GPS', 'نظام موسيقى'],
    medium: ['Air Conditioning', 'GPS Navigation', 'Premium Sound', 'Leather Seats'],
    mediumAr: ['تكييف هواء', 'نظام ملاحة GPS', 'نظام صوتي مميز', 'مقاعد جلدية'],
    vip: ['Air Conditioning', 'GPS Navigation', 'Premium Sound', 'Leather Seats', 'WiFi', 'Bottled Water'],
    vipAr: ['تكييف هواء', 'نظام ملاحة GPS', 'نظام صوتي مميز', 'مقاعد جلدية', 'واي فاي', 'مياه معبأة']
  }

  for (let i = 0; i < featureSets.regular.length; i++) {
    await prisma.categoryFeature.create({
      data: {
        vehicleCategoryId: regularCategory.id,
        name: featureSets.regular[i],
        nameAr: featureSets.regularAr[i],
        icon: '✓',
        status: 1
      }
    })
  }

  for (let i = 0; i < featureSets.medium.length; i++) {
    await prisma.categoryFeature.create({
      data: {
        vehicleCategoryId: mediumCategory.id,
        name: featureSets.medium[i],
        nameAr: featureSets.mediumAr[i],
        icon: '✓',
        status: 1
      }
    })
  }

  for (let i = 0; i < featureSets.vip.length; i++) {
    await prisma.categoryFeature.create({
      data: {
        vehicleCategoryId: vipCategory.id,
        name: featureSets.vip[i],
        nameAr: featureSets.vipAr[i],
        icon: '✓',
        status: 1
      }
    })
  }

  // Create Geographic Zones
  console.log('Creating geographic zones...')
  const downtownZone = await prisma.geographicZone.create({
    data: {
      name: 'Downtown Area',
      nameAr: 'منطقة وسط البلد',
      regionId: region1.id,
      centerLat: 24.7136,
      centerLng: 46.6753,
      radius: 10.0,
      coordinates: JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [46.6553, 24.6936],
          [46.6953, 24.6936],
          [46.6953, 24.7336],
          [46.6553, 24.7336],
          [46.6553, 24.6936]
        ]]
      }),
      status: 1
    }
  })

  const northZone = await prisma.geographicZone.create({
    data: {
      name: 'North District',
      nameAr: 'المنطقة الشمالية',
      regionId: region2.id,
      centerLat: 24.8,
      centerLng: 46.7,
      radius: 15.0,
      coordinates: JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [46.65, 24.75],
          [46.75, 24.75],
          [46.75, 24.85],
          [46.65, 24.85],
          [46.65, 24.75]
        ]]
      }),
      status: 1
    }
  })

  const aleppoZone = await prisma.geographicZone.create({
    data: {
      name: 'Aleppo Area',
      nameAr: 'منطقة حلب',
      regionId: region1.id,
      centerLat: 36.2021,
      centerLng: 37.1343,
      radius: 20.0,
      coordinates: JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [37.0843, 36.1521],
          [37.1843, 36.1521],
          [37.1843, 36.2521],
          [37.0843, 36.2521],
          [37.0843, 36.1521]
        ]]
      }),
      status: 1
    }
  })

  // Create Category-Zone Mappings
  console.log('Creating category-zone mappings...')
  await prisma.categoryZone.createMany({
    data: [
      { vehicleCategoryId: regularCategory.id, geographicZoneId: downtownZone.id, status: 1 },
      { vehicleCategoryId: regularCategory.id, geographicZoneId: northZone.id, status: 1 },
      { vehicleCategoryId: mediumCategory.id, geographicZoneId: downtownZone.id, status: 1 },
      { vehicleCategoryId: mediumCategory.id, geographicZoneId: northZone.id, status: 1 },
      { vehicleCategoryId: vipCategory.id, geographicZoneId: downtownZone.id, status: 1 },
      { vehicleCategoryId: suzukiCategory.id, geographicZoneId: downtownZone.id, status: 1 },
      { vehicleCategoryId: suzukiCategory.id, geographicZoneId: northZone.id, status: 1 },
      { vehicleCategoryId: quarterTruckCategory.id, geographicZoneId: downtownZone.id, status: 1 },
      { vehicleCategoryId: quarterTruckCategory.id, geographicZoneId: northZone.id, status: 1 },
      { vehicleCategoryId: quarterTruck3TonCategory.id, geographicZoneId: northZone.id, status: 1 },
      { vehicleCategoryId: jumboCategory.id, geographicZoneId: northZone.id, status: 1 },
    ]
  })

  // Create Pricing Rules
  console.log('Creating pricing rules...')
  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: regularCategory.id,
      baseFare: 10.0,
      baseDistance: 5.0,
      minimumFare: 15.0,
      perDistanceAfterBase: 2.0,
      perMinuteDrive: 0.5,
      perMinuteWait: 0.3,
      waitingTimeLimit: 5.0,
      cancellationFee: 5.0,
      commissionType: 'percentage',
      adminCommission: 15.0,
      fleetCommission: 5.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: mediumCategory.id,
      baseFare: 15.0,
      baseDistance: 5.0,
      minimumFare: 20.0,
      perDistanceAfterBase: 3.0,
      perMinuteDrive: 0.7,
      perMinuteWait: 0.4,
      waitingTimeLimit: 5.0,
      cancellationFee: 7.0,
      commissionType: 'percentage',
      adminCommission: 18.0,
      fleetCommission: 7.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: vipCategory.id,
      baseFare: 25.0,
      baseDistance: 5.0,
      minimumFare: 35.0,
      perDistanceAfterBase: 5.0,
      perMinuteDrive: 1.2,
      perMinuteWait: 0.8,
      waitingTimeLimit: 5.0,
      cancellationFee: 15.0,
      commissionType: 'percentage',
      adminCommission: 20.0,
      fleetCommission: 10.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: suzukiCategory.id,
      baseFare: 20.0,
      baseDistance: 5.0,
      minimumFare: 25.0,
      perDistanceAfterBase: 3.5,
      perMinuteDrive: 0.6,
      perMinuteWait: 0.3,
      waitingTimeLimit: 10.0,
      cancellationFee: 10.0,
      commissionType: 'percentage',
      adminCommission: 15.0,
      fleetCommission: 5.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: quarterTruckCategory.id,
      baseFare: 30.0,
      baseDistance: 5.0,
      minimumFare: 40.0,
      perDistanceAfterBase: 5.0,
      perMinuteDrive: 0.8,
      perMinuteWait: 0.5,
      waitingTimeLimit: 10.0,
      cancellationFee: 15.0,
      commissionType: 'percentage',
      adminCommission: 18.0,
      fleetCommission: 7.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: quarterTruck3TonCategory.id,
      baseFare: 45.0,
      baseDistance: 5.0,
      minimumFare: 60.0,
      perDistanceAfterBase: 7.0,
      perMinuteDrive: 1.0,
      perMinuteWait: 0.6,
      waitingTimeLimit: 15.0,
      cancellationFee: 20.0,
      commissionType: 'percentage',
      adminCommission: 20.0,
      fleetCommission: 8.0,
      status: 1
    }
  })

  await prisma.pricingRule.create({
    data: {
      vehicleCategoryId: jumboCategory.id,
      baseFare: 60.0,
      baseDistance: 5.0,
      minimumFare: 80.0,
      perDistanceAfterBase: 10.0,
      perMinuteDrive: 1.5,
      perMinuteWait: 0.8,
      waitingTimeLimit: 15.0,
      cancellationFee: 25.0,
      commissionType: 'percentage',
      adminCommission: 22.0,
      fleetCommission: 10.0,
      status: 1
    }
  })

  // Create Sample Tourist Trips
  console.log('Creating sample tourist trips...')
  await prisma.touristTrip.create({
    data: {
      riderId: rider1.id,
      driverId: driver1.id,
      vehicleCategoryId: vipCategory.id,
      serviceId: service2.id,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-05'),
      startLocation: 'Riyadh Downtown',
      startLatitude: '24.7136',
      startLongitude: '46.6753',
      destinations: JSON.stringify([
        { name: 'Historical Diriyah', lat: 24.7324, lng: 46.5740 },
        { name: 'Edge of the World', lat: 25.0939, lng: 45.8925 },
        { name: 'Riyadh Boulevard', lat: 24.7715, lng: 46.6731 }
      ]),
      totalAmount: 1500.0,
      paymentStatus: 'paid',
      paymentType: 'card',
      requiresDedicatedDriver: true,
      notes: 'Multi-day VIP tour around Riyadh',
      notesAr: 'جولة VIP متعددة الأيام في الرياض',
      status: 'confirmed'
    }
  })

  await prisma.touristTrip.create({
    data: {
      riderId: rider2.id,
      vehicleCategoryId: mediumCategory.id,
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-17'),
      startLocation: 'Jeddah Corniche',
      startLatitude: '21.5433',
      startLongitude: '39.1728',
      destinations: JSON.stringify([
        { name: 'Al-Balad Historic District', lat: 21.4858, lng: 39.1925 },
        { name: 'King Fahd Fountain', lat: 21.5250, lng: 39.1561 }
      ]),
      totalAmount: 800.0,
      paymentStatus: 'pending',
      paymentType: 'cash',
      requiresDedicatedDriver: true,
      notes: 'Weekend tour in Jeddah',
      notesAr: 'جولة عطلة نهاية الأسبوع في جدة',
      status: 'pending'
    }
  })

  console.log('')
  console.log('✅ Multi-service platform data seeded successfully!')
  console.log('   - Service Categories: 3 (Passenger, Cargo, Additional)')
  console.log('   - Vehicle Categories: 7 (Regular, Medium, VIP, Suzuki, Quarter Truck, 3-Ton, Jumbo)')
  console.log('   - Geographic Zones: 3')
  console.log('   - Pricing Rules: 7')
  console.log('   - Tourist Trips: 2')

  console.log('')
  console.log('🔑 Test Credentials:')
  console.log('   Admin: admin@alaelsareea.com / password123')
  console.log('   Fleet: fleet@alaelsareea.com / password123')
  console.log('   Rider: ahmed@example.com / password123')
  console.log('   Driver: khalid@example.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

