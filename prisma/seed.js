import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// نسبة السستم الافتراضية (تُستخدم في seed للمحافظ والأرباح)
const SYSTEM_COMMISSION_PCT = 15
function getDriverAndSystemShare(rideTotal) {
  const total = parseFloat(rideTotal) || 0
  if (total <= 0) return { driverShare: 0, systemShare: 0 }
  const systemShare = Math.round((total * SYSTEM_COMMISSION_PCT) / 100 * 100) / 100
  const driverShare = Math.round((total - systemShare) * 100) / 100
  return { driverShare, systemShare }
}

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
  await prisma.withdrawRequest.deleteMany()
  await prisma.walletHistory.deleteMany()
  await prisma.wallet.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.rideRequest.deleteMany()
  await prisma.bookingLocationUpdate.deleteMany()
  await prisma.bookingInvoice.deleteMany()
  await prisma.dedicatedBooking.deleteMany()
  await prisma.touristTrip.deleteMany()
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
  await prisma.categoryZone.deleteMany()
  await prisma.pricingRule.deleteMany()
  await prisma.vehicleCategory.deleteMany()
  await prisma.serviceCategory.deleteMany()
  await prisma.geographicZone.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.userAddress.deleteMany()
  await prisma.userBankCard.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()

  // Default app settings (العملة بالجنيه المصري)
  console.log('Creating default settings...')
  await prisma.setting.upsert({ where: { key: 'appName' }, update: { value: 'على السريع' }, create: { key: 'appName', value: 'على السريع' } })
  await prisma.setting.upsert({ where: { key: 'currency' }, update: { value: 'EGP' }, create: { key: 'currency', value: 'EGP' } })
  await prisma.setting.upsert({ where: { key: 'distanceUnit' }, update: { value: 'km' }, create: { key: 'distanceUnit', value: 'km' } })
  await prisma.setting.upsert({ where: { key: 'system_commission_percentage' }, update: { value: '15' }, create: { key: 'system_commission_percentage', value: '15' } })

  // Payment methods (طرق الدفع)
  console.log('Creating payment methods...')
  try {
    await prisma.paymentMethod.deleteMany()
  } catch (_) {}
  await prisma.paymentMethod.createMany({
    data: [
      { name: 'Bank Card', nameAr: 'بطاقة بنكية', code: 'card', status: 1, sortOrder: 1 },
      { name: 'E-Wallet', nameAr: 'محفظة إلكترونية', code: 'wallet', status: 1, sortOrder: 2 },
      { name: 'Fawry', nameAr: 'فوري', code: 'fawry', status: 1, sortOrder: 3 },
      { name: 'Cash', nameAr: 'كاش', code: 'cash', status: 1, sortOrder: 4 }
    ]
  })

  // Payment gateways (بوابات الدفع)
  console.log('Creating payment gateways...')
  try {
    await prisma.paymentGateway.deleteMany()
  } catch (_) {}
  await prisma.paymentGateway.createMany({
    data: [
      { title: 'Stripe', type: 'stripe', status: 1, isTest: true, testValue: { publishableKey: 'pk_test_xxx', secretKey: 'sk_test_xxx' }, liveValue: null },
      { title: 'Fawry', type: 'fawry', status: 1, isTest: true, testValue: { merchantCode: 'test', secureKey: 'test' }, liveValue: null },
      { title: 'PayMob', type: 'paymob', status: 1, isTest: true, testValue: { apiKey: 'test', integrationId: 0 }, liveValue: null }
    ]
  })

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
      isAvailable: true,
      isVerified: true
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
      isAvailable: true,
      isVerified: true
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
      isAvailable: false,
      isVerified: true
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
      isAvailable: false,
      isVerified: true
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
      isAvailable: false,
      isVerified: true
    }
  })

  // Mobile API test user (login: phone 01234567890 / password Test1234)
  const mobileTestUser = await prisma.user.create({
    data: {
      firstName: 'Mobile',
      lastName: 'Tester',
      email: 'mobile.test@example.com',
      username: 'mobile_tester',
      password: await bcrypt.hash('Test1234', 10),
      contactNumber: '01234567890',
      userType: 'rider',
      status: 'active',
      displayName: 'Mobile Tester',
      address: 'Cairo, Egypt',
      latitude: '30.0444',
      longitude: '31.2357',
      isOnline: true,
      isAvailable: false,
      isVerified: true
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
      avatar: 'https://i.pravatar.cc/300?img=12',
      serviceId: service1.id,
      fleetId: fleet.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date(),
      isVerified: true
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
      avatar: 'https://i.pravatar.cc/300?img=5',
      serviceId: service2.id,
      fleetId: fleet.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date(),
      isVerified: true
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
      avatar: 'https://i.pravatar.cc/300?img=33',
      latitude: '24.76',
      longitude: '46.69',
      serviceId: service3.id,
      isOnline: false,
      isAvailable: false,
      isVerifiedDriver: false,
      isVerified: true
    }
  })

  // Extra drivers (Egypt – محافظ سائقين بالجنيه المصري)
  const driver4 = await prisma.user.create({
    data: {
      firstName: 'محمد',
      lastName: 'علي',
      email: 'mohamed.ali@example.com',
      username: 'mohamed_ali_driver',
      password: hashedPassword,
      contactNumber: '01001234567',
      userType: 'driver',
      status: 'active',
      displayName: 'محمد علي',
      address: 'مدينة نصر، القاهرة',
      latitude: '30.0731',
      longitude: '31.3456',
      avatar: 'https://i.pravatar.cc/300?img=15',
      serviceId: service1.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date(),
      isVerified: true
    }
  })

  const driver5 = await prisma.user.create({
    data: {
      firstName: 'أحمد',
      lastName: 'حسن',
      email: 'ahmed.hassan@example.com',
      username: 'ahmed_hassan_driver',
      password: hashedPassword,
      contactNumber: '01112233445',
      userType: 'driver',
      status: 'active',
      displayName: 'أحمد حسن',
      address: 'المعادي، القاهرة',
      latitude: '29.9602',
      longitude: '31.2569',
      avatar: 'https://i.pravatar.cc/300?img=22',
      serviceId: service2.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date(),
      isVerified: true
    }
  })

  const driver6 = await prisma.user.create({
    data: {
      firstName: 'يوسف',
      lastName: 'إبراهيم',
      email: 'youssef.ibrahim@example.com',
      username: 'youssef_ibrahim_driver',
      password: hashedPassword,
      contactNumber: '01223344556',
      userType: 'driver',
      status: 'active',
      displayName: 'يوسف إبراهيم',
      address: '6 أكتوبر، الجيزة',
      latitude: '30.0442',
      longitude: '30.9765',
      avatar: 'https://i.pravatar.cc/300?img=8',
      serviceId: service1.id,
      isOnline: false,
      isAvailable: true,
      isVerifiedDriver: true,
      isVerified: true
    }
  })

  const driver7 = await prisma.user.create({
    data: {
      firstName: 'خالد',
      lastName: 'محمود',
      email: 'khaled.mahmoud@example.com',
      username: 'khaled_mahmoud_driver',
      password: hashedPassword,
      contactNumber: '01556677889',
      userType: 'driver',
      status: 'active',
      displayName: 'خالد محمود',
      address: 'الشيخ زايد، الجيزة',
      latitude: '30.05',
      longitude: '30.98',
      avatar: 'https://i.pravatar.cc/300?img=11',
      serviceId: service3.id,
      isOnline: true,
      isAvailable: true,
      isVerifiedDriver: true,
      lastActivedAt: new Date(),
      isVerified: true
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
      carImage: 'https://cdn.pixabay.com/photo/2016/02/13/13/11/toyota-1197712_1280.jpg',
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
      carImage: 'https://cdn.pixabay.com/photo/2018/02/21/03/15/honda-3169620_1280.jpg',
      workAddress: 'North District',
      homeAddress: 'Driver Residence 2',
      workLatitude: '24.8',
      workLongitude: '46.7',
      homeLatitude: '24.78',
      homeLongitude: '46.72'
    }
  })

  await prisma.userDetail.create({
    data: {
      userId: driver4.id,
      carModel: 'Hyundai i20',
      carColor: 'Silver',
      carPlateNumber: 'ط ص ع 1234',
      carProductionYear: 2022,
      carImage: 'https://cdn.pixabay.com/photo/2017/03/04/16/38/car-2116549_1280.jpg',
      workAddress: 'مدينة نصر',
      homeAddress: 'مدينة نصر، القاهرة',
      workLatitude: '30.0731',
      workLongitude: '31.3456',
      homeLatitude: '30.0731',
      homeLongitude: '31.3456'
    }
  })
  await prisma.userDetail.create({
    data: {
      userId: driver5.id,
      carModel: 'Kia Cerato',
      carColor: 'White',
      carPlateNumber: 'ط ص ع 5678',
      carProductionYear: 2023,
      carImage: 'https://cdn.pixabay.com/photo/2012/11/02/13/02/car-63930_1280.jpg',
      workAddress: 'المعادي',
      homeAddress: 'المعادي، القاهرة',
      workLatitude: '29.9602',
      workLongitude: '31.2569',
      homeLatitude: '29.9602',
      homeLongitude: '31.2569'
    }
  })
  await prisma.userDetail.create({
    data: {
      userId: driver6.id,
      carModel: 'Chevrolet Optra',
      carColor: 'Black',
      carPlateNumber: 'ط ص ع 9012',
      carProductionYear: 2021,
      carImage: 'https://cdn.pixabay.com/photo/2016/12/03/18/57/car-1880381_1280.jpg',
      workAddress: '6 أكتوبر',
      homeAddress: '6 أكتوبر، الجيزة',
      workLatitude: '30.0442',
      workLongitude: '30.9765',
      homeLatitude: '30.0442',
      homeLongitude: '30.9765'
    }
  })
  await prisma.userDetail.create({
    data: {
      userId: driver7.id,
      carModel: 'Toyota Corolla',
      carColor: 'Gray',
      carPlateNumber: 'ط ص ع 3456',
      carProductionYear: 2023,
      carImage: 'https://cdn.pixabay.com/photo/2014/05/18/19/13/toyota-347288_1280.jpg',
      workAddress: 'الشيخ زايد',
      homeAddress: 'الشيخ زايد، الجيزة',
      workLatitude: '30.05',
      workLongitude: '30.98',
      homeLatitude: '30.05',
      homeLongitude: '30.98'
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

  // Create Wallets (العملة: جنيه مصري EGP)
  const defaultCurrency = 'EGP'
  console.log('Creating wallets...')
  await prisma.wallet.create({
    data: {
      userId: rider1.id,
      balance: 500.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: driver1.id,
      balance: 2500.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: driver2.id,
      balance: 1800.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: driver3.id,
      balance: 0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: rider2.id,
      balance: 120.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: rider3.id,
      balance: 80.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({
    data: {
      userId: mobileTestUser.id,
      balance: 350.0,
      currency: defaultCurrency
    }
  })

  await prisma.wallet.create({ data: { userId: driver4.id, balance: 3200.0, currency: defaultCurrency } })
  await prisma.wallet.create({ data: { userId: driver5.id, balance: 2100.0, currency: defaultCurrency } })
  await prisma.wallet.create({ data: { userId: driver6.id, balance: 950.0, currency: defaultCurrency } })
  await prisma.wallet.create({ data: { userId: driver7.id, balance: 4100.0, currency: defaultCurrency } })

  // User saved addresses (for GET /apimobile/user/addresses) – rider1
  console.log('Creating user addresses...')
  await prisma.userAddress.create({
    data: {
      userId: rider1.id,
      title: 'Home',
      address: '123 Main Street, Downtown',
      latitude: '24.7136',
      longitude: '46.6753',
      isDefault: true
    }
  })
  await prisma.userAddress.create({
    data: {
      userId: rider1.id,
      title: 'Work',
      address: '456 Business Tower, Financial District',
      latitude: '24.72',
      longitude: '46.68',
      isDefault: false
    }
  })
  await prisma.userAddress.create({
    data: {
      userId: rider1.id,
      title: 'Gym',
      address: '789 Fitness Center, North District',
      latitude: '24.75',
      longitude: '46.70',
      isDefault: false
    }
  })

  await prisma.userAddress.create({
    data: {
      userId: mobileTestUser.id,
      title: 'Home',
      address: 'Cairo, Downtown',
      latitude: '30.0444',
      longitude: '31.2357',
      isDefault: true
    }
  })
  await prisma.userAddress.create({
    data: {
      userId: mobileTestUser.id,
      title: 'Office',
      address: 'Nasr City, Cairo',
      latitude: '30.0731',
      longitude: '31.3456',
      isDefault: false
    }
  })

  await prisma.userBankCard.create({
    data: {
      userId: mobileTestUser.id,
      cardHolderName: 'Mobile Tester',
      lastFourDigits: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2028,
      isDefault: true
    }
  })
  await prisma.userBankCard.create({
    data: {
      userId: mobileTestUser.id,
      cardHolderName: 'Mobile Tester',
      lastFourDigits: '5555',
      brand: 'mastercard',
      expiryMonth: 6,
      expiryYear: 2027,
      isDefault: false
    }
  })

  // Notifications for rider1 (for GET /apimobile/user/notifications)
  console.log('Creating notifications...')
  await prisma.notification.create({
    data: {
      type: 'ride_completed',
      notifiableType: 'user',
      notifiableId: rider1.id,
      data: { title: 'Trip completed', body: 'Your trip to 456 Park Avenue has been completed. Thank you for riding!', rideRequestId: null },
      isRead: false
    }
  })
  await prisma.notification.create({
    data: {
      type: 'promo',
      notifiableType: 'user',
      notifiableId: rider1.id,
      data: { title: 'Special offer', body: 'Get 20% off your next ride with code WELCOME20', code: 'WELCOME20' },
      isRead: false
    }
  })
  await prisma.notification.create({
    data: {
      type: 'reminder',
      notifiableType: 'user',
      notifiableId: rider1.id,
      data: { title: 'Don\'t forget to rate', body: 'Rate your last trip and help us improve.' },
      isRead: true,
      readAt: new Date()
    }
  })

  await prisma.notification.create({
    data: {
      type: 'ride_completed',
      notifiableType: 'user',
      notifiableId: mobileTestUser.id,
      data: { title: 'Trip completed', body: 'Your trip has been completed. Thank you!', rideRequestId: null },
      isRead: false
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
      driver: { connect: { id: driver1.id } },
      document: { connect: { id: doc1.id } },
      isVerified: true,
      expireDate: new Date('2025-12-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driver: { connect: { id: driver1.id } },
      document: { connect: { id: doc2.id } },
      isVerified: true,
      expireDate: new Date('2025-06-30')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driver: { connect: { id: driver1.id } },
      document: { connect: { id: doc3.id } },
      isVerified: true,
      expireDate: new Date('2025-03-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driver: { connect: { id: driver2.id } },
      document: { connect: { id: doc1.id } },
      isVerified: true,
      expireDate: new Date('2026-01-31')
    }
  })

  await prisma.driverDocument.create({
    data: {
      driver: { connect: { id: driver2.id } },
      document: { connect: { id: doc2.id } },
      isVerified: true,
      expireDate: new Date('2025-08-31')
    }
  })

  // Create Coupons = Slider offers (GET /apimobile/user/home/slider-offers). No dates = always valid.
  console.log('Creating coupons (slider offers)...')
  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        title: 'Welcome Discount',
        titleAr: 'خصم الترحيب',
        couponType: 'first_ride',
        usageLimitPerRider: 1,
        discountType: 'percentage',
        discount: 10.0,
        startDate: null,
        endDate: null,
        minimumAmount: 20.0,
        maximumDiscount: 50.0,
        status: 1,
        description: '10% off on your first ride',
        descriptionAr: 'خصم 10% على أول رحلة لك',
        imageUrl: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',
        serviceIds: [service1.id, service2.id],
        regionIds: JSON.stringify([region1.id])
      },
      {
        code: 'SAVE20',
        title: 'Save 20 SAR',
        titleAr: 'وفر 20 ريال',
        couponType: 'all',
        usageLimitPerRider: 5,
        discountType: 'fixed',
        discount: 20.0,
        startDate: null,
        endDate: null,
        minimumAmount: 50.0,
        maximumDiscount: 20.0,
        status: 1,
        description: 'Save 20 SAR on rides above 50 SAR',
        descriptionAr: 'وفر 20 ريال على الرحلات فوق 50 ريال',
        imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
        serviceIds: [service1.id, service2.id, service3.id],
        regionIds: JSON.stringify([region1.id, region2.id])
      },
      {
        code: 'WEEKEND15',
        title: 'Weekend Special',
        titleAr: 'عرض نهاية الأسبوع',
        couponType: 'all',
        usageLimitPerRider: 3,
        discountType: 'percentage',
        discount: 15.0,
        startDate: null,
        endDate: null,
        minimumAmount: 30.0,
        maximumDiscount: 100.0,
        status: 1,
        description: '15% off on weekends',
        descriptionAr: 'خصم 15% في عطلة نهاية الأسبوع',
        imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800',
        serviceIds: [service2.id, service3.id],
        regionIds: JSON.stringify([region1.id, region2.id])
      },
      {
        code: 'SUMMER25',
        title: 'Summer Ride',
        titleAr: 'عرض الصيف',
        couponType: 'all',
        usageLimitPerRider: 2,
        discountType: 'percentage',
        discount: 25.0,
        startDate: null,
        endDate: null,
        minimumAmount: 40.0,
        maximumDiscount: 75.0,
        status: 1,
        description: '25% off summer rides',
        descriptionAr: 'خصم 25% على رحلات الصيف',
        imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800',
        serviceIds: [service1.id, service2.id, service3.id],
        regionIds: JSON.stringify([region1.id, region2.id])
      },
      {
        code: 'FIXED30',
        title: '30 SAR Off',
        titleAr: 'خصم 30 ريال',
        couponType: 'all',
        usageLimitPerRider: 1,
        discountType: 'fixed',
        discount: 30.0,
        startDate: null,
        endDate: null,
        minimumAmount: 80.0,
        maximumDiscount: 30.0,
        status: 1,
        description: 'Save 30 SAR on rides above 80 SAR',
        descriptionAr: 'وفر 30 ريال على الرحلات فوق 80 ريال',
        imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
        serviceIds: [service2.id, service3.id],
        regionIds: JSON.stringify([region1.id, region2.id])
      },
      {
        code: 'FIRST50',
        title: 'First Ride 50%',
        titleAr: 'أول رحلة 50%',
        couponType: 'first_ride',
        usageLimitPerRider: 1,
        discountType: 'percentage',
        discount: 50.0,
        startDate: null,
        endDate: null,
        minimumAmount: 15.0,
        maximumDiscount: 40.0,
        status: 1,
        description: '50% off your first ride',
        descriptionAr: 'خصم 50% على أول رحلة لك',
        imageUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800',
        serviceIds: [service1.id],
        regionIds: JSON.stringify([region1.id])
      },
      {
        code: 'NIGHT10',
        title: 'Night Discount',
        titleAr: 'خصم الليل',
        couponType: 'all',
        usageLimitPerRider: 10,
        discountType: 'percentage',
        discount: 10.0,
        startDate: null,
        endDate: null,
        minimumAmount: 25.0,
        maximumDiscount: 25.0,
        status: 1,
        description: '10% off night rides',
        descriptionAr: 'خصم 10% على رحلات الليل',
        imageUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800',
        serviceIds: [service1.id, service2.id, service3.id],
        regionIds: JSON.stringify([region1.id, region2.id])
      }
    ]
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
      status: 'completed',
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

  // رحلة كاش لسائق 4 (محمد علي) — لضمان ظهور نسبة السستم المخصومة في محفظته
  const ride4 = await prisma.rideRequest.create({
    data: {
      riderId: rider3.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 100.0,
      surgeAmount: 0,
      subtotal: 100.0,
      extraChargesAmount: 0,
      driverId: driver4.id,
      startLatitude: '30.0731',
      startLongitude: '31.3456',
      startAddress: 'مدينة نصر',
      endLatitude: '30.0444',
      endLongitude: '31.2357',
      endAddress: 'وسط البلد القاهرة',
      distance: 10.0,
      duration: 20,
      seatCount: 1,
      status: 'completed',
      rideHasBid: false,
      baseFare: 10.0,
      minimumFare: 15.0,
      perDistance: 2.5,
      perMinuteDrive: 0.5,
      paymentType: 'cash',
      isRiderRated: true,
      isDriverRated: true
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

  // Last active booking for rider1 (pending/accepted/started/arrived) – so GET last-booking returns data
  const rideR1Active = await prisma.rideRequest.create({
    data: {
      riderId: rider1.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 35.0,
      surgeAmount: 0,
      subtotal: 35.0,
      extraChargesAmount: 0,
      driverId: driver1.id,
      otp: '789012',
      startLatitude: '24.7136',
      startLongitude: '46.6753',
      startAddress: '123 Main Street, Downtown',
      endLatitude: '24.72',
      endLongitude: '46.67',
      endAddress: 'Mall of Arabia',
      distance: 10.0,
      duration: 18,
      seatCount: 1,
      status: 'accepted',
      rideHasBid: false,
      baseFare: 12.0,
      minimumFare: 18.0,
      perDistance: 2.0,
      perDistanceCharge: 20.0,
      perMinuteDrive: 0.5,
      perMinuteDriveCharge: 9.0,
      paymentType: 'cash',
      isRiderRated: false,
      isDriverRated: false
    }
  })

  const rideMobilePending = await prisma.rideRequest.create({
    data: {
      riderId: mobileTestUser.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 28.0,
      surgeAmount: 0,
      subtotal: 28.0,
      extraChargesAmount: 0,
      driverId: driver1.id,
      startLatitude: '30.0444',
      startLongitude: '31.2357',
      startAddress: 'Cairo, Downtown',
      endLatitude: '30.0731',
      endLongitude: '31.3456',
      endAddress: 'Nasr City, Cairo',
      distance: 8.0,
      duration: 15,
      seatCount: 1,
      status: 'accepted',
      rideHasBid: false,
      baseFare: 10.0,
      minimumFare: 15.0,
      perDistance: 2.5,
      perMinuteDrive: 0.5,
      paymentType: 'card',
      otp: '1234',
      isRiderRated: false,
      isDriverRated: false
    }
  })

  // 4 more active bookings for mobile user (5 total active → last-bookings array of 5)
  const mobileActiveTrips = [
    { from: 'Maadi', to: 'Zamalek', lat: '30.05', lng: '31.22', amount: 35, otp: '2345', status: 'accepted' },
    { from: 'Heliopolis', to: 'Nasr City', lat: '30.07', lng: '31.35', amount: 42, otp: '3456', status: 'started' },
    { from: 'Dokki', to: 'Giza', lat: '30.01', lng: '31.02', amount: 65, otp: '4567', status: 'accepted' },
    { from: 'New Cairo', to: 'Airport', lat: '30.08', lng: '31.40', amount: 95, otp: '5678', status: 'arrived' }
  ]
  for (const t of mobileActiveTrips) {
    await prisma.rideRequest.create({
      data: {
        riderId: mobileTestUser.id,
        serviceId: service1.id,
        datetime: new Date(),
        isSchedule: false,
        rideAttempt: 1,
        distanceUnit: 'km',
        totalAmount: t.amount,
        surgeAmount: 0,
        subtotal: t.amount,
        extraChargesAmount: 0,
        driverId: driver1.id,
        startLatitude: '30.0444',
        startLongitude: '31.2357',
        startAddress: t.from,
        endLatitude: t.lat,
        endLongitude: t.lng,
        endAddress: t.to,
        distance: 8,
        duration: 15,
        seatCount: 1,
        status: t.status,
        rideHasBid: false,
        baseFare: 10.0,
        minimumFare: 15.0,
        perDistance: 2.5,
        perMinuteDrive: 0.5,
        paymentType: 'card',
        otp: t.otp,
        isRiderRated: false,
        isDriverRated: false
      }
    })
  }

  const rideMobileCompleted = await prisma.rideRequest.create({
    data: {
      riderId: mobileTestUser.id,
      serviceId: service1.id,
      datetime: new Date(),
      isSchedule: false,
      rideAttempt: 1,
      distanceUnit: 'km',
      totalAmount: 45.0,
      surgeAmount: 0,
      subtotal: 45.0,
      extraChargesAmount: 0,
      driverId: driver1.id,
      startLatitude: '30.0444',
      startLongitude: '31.2357',
      startAddress: 'Cairo, Downtown',
      endLatitude: '30.05',
      endLongitude: '31.25',
      endAddress: 'Giza',
      distance: 12.0,
      duration: 22,
      seatCount: 1,
      status: 'completed',
      rideHasBid: false,
      baseFare: 10.0,
      minimumFare: 15.0,
      perDistance: 2.5,
      perDistanceCharge: 30.0,
      perMinuteDrive: 0.5,
      perMinuteDriveCharge: 11.0,
      paymentType: 'card',
      isRiderRated: true,
      isDriverRated: true
    }
  })

  // Many more bookings for mobile test user (Phone: 01234567890 / Password: Test1234)
  const mobileUserExtraTrips = [
    { from: 'Cairo Airport', to: 'Heliopolis', lat: '30.08', lng: '31.32', amount: 85 },
    { from: 'Maadi', to: 'Zamalek', lat: '30.05', lng: '31.22', amount: 35 },
    { from: '6th October', to: 'Downtown Cairo', lat: '30.02', lng: '30.98', amount: 120 },
    { from: 'New Cairo', to: 'Nasr City', lat: '30.07', lng: '31.35', amount: 42 },
    { from: 'Dokki', to: 'Giza Pyramids', lat: '30.01', lng: '31.02', amount: 65 },
    { from: 'Mohandessin', to: 'Agouza', lat: '30.06', lng: '31.20', amount: 28 },
    { from: 'Helwan', to: 'Maadi', lat: '29.87', lng: '31.33', amount: 55 },
    { from: 'Shoubra', to: 'Abbasya', lat: '30.08', lng: '31.24', amount: 38 },
    { from: 'Hadayek El Kobba', to: 'Roxy', lat: '30.09', lng: '31.32', amount: 32 },
    { from: 'Mokattam', to: 'Cairo Festival', lat: '30.01', lng: '31.36', amount: 48 },
    { from: 'Rehab City', to: 'Sheraton', lat: '30.09', lng: '31.42', amount: 52 },
    { from: '5th Settlement', to: 'Airport', lat: '30.10', lng: '31.40', amount: 95 },
    { from: 'Faisal', to: 'Haram', lat: '29.98', lng: '31.12', amount: 58 },
    { from: 'Imbaba', to: 'Orman', lat: '30.10', lng: '31.21', amount: 40 },
    { from: 'Tagamoaa', to: 'Nasr City', lat: '30.11', lng: '31.38', amount: 45 }
  ]
  const servicesForMobile = [service1, service2]
  for (let i = 0; i < mobileUserExtraTrips.length; i++) {
    const trip = mobileUserExtraTrips[i]
    const svc = servicesForMobile[i % servicesForMobile.length]
    const isCompleted = i % 3 !== 0
    await prisma.rideRequest.create({
      data: {
        riderId: mobileTestUser.id,
        serviceId: svc.id,
        datetime: new Date(Date.now() - (i + 1) * 86400000),
        isSchedule: false,
        rideAttempt: 1,
        distanceUnit: 'km',
        totalAmount: trip.amount,
        surgeAmount: 0,
        subtotal: trip.amount,
        extraChargesAmount: 0,
        driverId: isCompleted ? driver1.id : (i % 2 === 0 ? driver2.id : null),
        startLatitude: '30.0444',
        startLongitude: '31.2357',
        startAddress: trip.from,
        endLatitude: trip.lat,
        endLongitude: trip.lng,
        endAddress: trip.to,
        distance: 8 + (i % 5),
        duration: 15 + (i % 10),
        seatCount: 1,
        status: isCompleted ? 'completed' : 'cancelled',
        rideHasBid: false,
        baseFare: 10.0,
        minimumFare: 15.0,
        perDistance: 2.5,
        perDistanceCharge: trip.amount * 0.6,
        perMinuteDrive: 0.5,
        perMinuteDriveCharge: trip.amount * 0.2,
        paymentType: i % 2 === 0 ? 'card' : 'cash',
        isRiderRated: isCompleted,
        isDriverRated: isCompleted
      }
    })
  }

  // Last: PaySky test rides so they sort first (newest) on admin ride list (per_page default was hiding them)
  console.log('Creating PaySky payment-test ride requests (pending card payment)...')
  const payTestRideDefs = [
    {
      rider: rider1,
      driver: driver1,
      amount: 55.0,
      note: 'SEED PaySky test A — rider1 / driver1',
    },
    {
      rider: rider2,
      driver: driver3,
      amount: 72.5,
      note: 'SEED PaySky test B — rider2 / driver3',
    },
    {
      rider: mobileTestUser,
      driver: driver2,
      amount: 99.99,
      note: 'SEED PaySky test C — mobile user 01234567890 / driver2',
    },
  ]
  const payTestRides = []
  for (const d of payTestRideDefs) {
    const rr = await prisma.rideRequest.create({
      data: {
        riderId: d.rider.id,
        serviceId: service1.id,
        datetime: new Date(),
        isSchedule: false,
        rideAttempt: 1,
        distanceUnit: 'km',
        totalAmount: d.amount,
        surgeAmount: 0,
        subtotal: d.amount,
        extraChargesAmount: 0,
        driverId: d.driver.id,
        startLatitude: '30.0444',
        startLongitude: '31.2357',
        startAddress: `${d.note} — pickup`,
        endLatitude: '30.06',
        endLongitude: '31.25',
        endAddress: `${d.note} — dropoff`,
        distance: 9.0,
        duration: 18,
        seatCount: 1,
        status: 'completed',
        rideHasBid: false,
        baseFare: 12.0,
        minimumFare: 18.0,
        perDistance: 2.5,
        perDistanceCharge: Math.round(d.amount * 0.45 * 100) / 100,
        perMinuteDrive: 0.5,
        perMinuteDriveCharge: Math.round(d.amount * 0.12 * 100) / 100,
        paymentType: 'card',
        tips: 0,
        isRiderRated: false,
        isDriverRated: false,
        internalNote:
          'Seed: card payment pending (awaiting PaySky / simulate). IDs logged after seed.',
      },
    })
    payTestRides.push(rr)
  }

  // Wallet operations for rider1 (so GET /apimobile/user/wallet/operations returns data)
  const walletR1 = await prisma.wallet.findFirst({ where: { userId: rider1.id } })
  if (walletR1) {
    await prisma.walletHistory.create({
      data: {
        walletId: walletR1.id,
        userId: rider1.id,
        type: 'credit',
        amount: 200,
        balance: 200,
        description: 'Top up',
        transactionType: 'topup'
      }
    })
    await prisma.walletHistory.create({
      data: {
        walletId: walletR1.id,
        userId: rider1.id,
        type: 'debit',
        amount: 25.50,
        balance: 174.50,
        description: 'Ride payment',
        transactionType: 'ride_payment',
        rideRequestId: ride1.id
      }
    })
    await prisma.walletHistory.create({
      data: {
        walletId: walletR1.id,
        userId: rider1.id,
        type: 'credit',
        amount: 325.50,
        balance: 500,
        description: 'Top up',
        transactionType: 'topup'
      }
    })
  }

  const walletMobile = await prisma.wallet.findFirst({ where: { userId: mobileTestUser.id } })
  if (walletMobile) {
    await prisma.walletHistory.create({
      data: {
        walletId: walletMobile.id,
        userId: mobileTestUser.id,
        type: 'credit',
        amount: 200,
        balance: 200,
        description: 'Top up',
        transactionType: 'topup'
      }
    })
    await prisma.walletHistory.create({
      data: {
        walletId: walletMobile.id,
        userId: mobileTestUser.id,
        type: 'debit',
        amount: 50,
        balance: 150,
        description: 'Ride payment',
        transactionType: 'ride_payment'
      }
    })
    await prisma.walletHistory.create({
      data: {
        walletId: walletMobile.id,
        userId: mobileTestUser.id,
        type: 'credit',
        amount: 200,
        balance: 350,
        description: 'Top up',
        transactionType: 'topup'
      }
    })
  }

  // ——— محافظ ومعاملات ونسبة السستم (seed نظيف) ———
  console.log('Creating payments and wallet transactions (with system commission)...')

  const ride1Total = 25.50
  const ride2Total = 45.0
  const ride4Total = 100.0
  const { systemShare: ride1SystemShare } = getDriverAndSystemShare(ride1Total)
  const { driverShare: ride2DriverShare, systemShare: ride2SystemShare } = getDriverAndSystemShare(ride2Total)
  const { systemShare: ride4SystemShare } = getDriverAndSystemShare(ride4Total)

  // Payments (مدفوعات الرحلات)
  await prisma.payment.create({
    data: {
      rideRequestId: ride1.id,
      userId: rider1.id,
      driverId: driver1.id,
      amount: ride1Total,
      paymentType: 'cash',
      paymentStatus: 'paid',
      paymentDate: new Date()
    }
  })
  await prisma.payment.create({
    data: {
      rideRequestId: ride2.id,
      userId: rider2.id,
      driverId: driver2.id,
      amount: ride2Total,
      paymentType: 'card',
      paymentStatus: 'paid',
      paymentDate: new Date()
    }
  })
  await prisma.payment.create({
    data: {
      rideRequestId: ride4.id,
      userId: rider3.id,
      driverId: driver4.id,
      amount: ride4Total,
      paymentType: 'cash',
      paymentStatus: 'paid',
      paymentDate: new Date()
    }
  })

  for (const rr of payTestRides) {
    await prisma.payment.create({
      data: {
        rideRequestId: rr.id,
        userId: rr.riderId,
        driverId: rr.driverId,
        amount: rr.totalAmount,
        paymentType: 'card',
        paymentStatus: 'pending',
        paymentDate: new Date(),
      },
    })
  }
  console.log(
    `   PaySky / simulate test ride IDs (pending card): ${payTestRides.map((r) => r.id).join(', ')}`
  )

  // رحلة 1 كاش: خصم نسبة السستم من محفظة السائق (لا إيداع أرباح — استلم الكاش)
  const walletD1 = await prisma.wallet.findFirst({ where: { userId: driver1.id } })
  if (walletD1) {
    const bal = parseFloat(walletD1.balance) || 0
    const newBal1 = Math.round((bal - ride1SystemShare) * 100) / 100
    await prisma.wallet.update({ where: { id: walletD1.id }, data: { balance: newBal1 } })
    await prisma.walletHistory.create({
      data: {
        walletId: walletD1.id,
        userId: driver1.id,
        type: 'debit',
        amount: ride1SystemShare,
        balance: newBal1,
        description: 'System commission (cash ride)',
        transactionType: 'system_commission_cash',
        rideRequestId: ride1.id
      }
    })
  }

  // رحلة 2 كارد: إيداع صافي أرباح السائق فقط (بعد خصم نسبة السستم)
  const walletD2 = await prisma.wallet.findFirst({ where: { userId: driver2.id } })
  if (walletD2) {
    const bal = parseFloat(walletD2.balance) || 0
    const newBal2 = Math.round((bal + ride2DriverShare) * 100) / 100
    await prisma.wallet.update({ where: { id: walletD2.id }, data: { balance: newBal2 } })
    await prisma.walletHistory.create({
      data: {
        walletId: walletD2.id,
        userId: driver2.id,
        type: 'credit',
        amount: ride2DriverShare,
        balance: newBal2,
        description: `Ride earnings | total: ${ride2Total} | system: ${ride2SystemShare} | net: ${ride2DriverShare}`,
        transactionType: 'ride_earnings',
        rideRequestId: ride2.id
      }
    })
  }

  // رحلة 4 كاش (سائق 4): خصم نسبة السستم من محفظة السائق
  const walletD4ForRide = await prisma.wallet.findFirst({ where: { userId: driver4.id } })
  if (walletD4ForRide) {
    const bal4Ride = parseFloat(walletD4ForRide.balance) || 0
    const newBal4AfterCommission = Math.round((bal4Ride - ride4SystemShare) * 100) / 100
    await prisma.wallet.update({ where: { id: walletD4ForRide.id }, data: { balance: newBal4AfterCommission } })
    await prisma.walletHistory.create({
      data: {
        walletId: walletD4ForRide.id,
        userId: driver4.id,
        type: 'debit',
        amount: ride4SystemShare,
        balance: newBal4AfterCommission,
        description: 'System commission (cash ride)',
        transactionType: 'system_commission_cash',
        rideRequestId: ride4.id
      }
    })
  }

  // طلبات سحب (مع خصم المحفظة عند الموافقة)
  const wdr1 = await prisma.withdrawRequest.create({
    data: { userId: driver1.id, amount: 500, currency: defaultCurrency, status: 0 }
  })
  const wdr2 = await prisma.withdrawRequest.create({
    data: { userId: driver2.id, amount: 300, currency: defaultCurrency, status: 0 }
  })
  const wdr4 = await prisma.withdrawRequest.create({
    data: { userId: driver4.id, amount: 200, currency: defaultCurrency, status: 1 }
  })

  // سحب مُوافق عليه لـ driver4: خصم من المحفظة + سجل معاملة
  const walletD4 = await prisma.wallet.findFirst({ where: { userId: driver4.id } })
  if (walletD4) {
    const bal4 = parseFloat(walletD4.balance) || 0
    const newBal4 = Math.round((bal4 - 200) * 100) / 100
    await prisma.wallet.update({ where: { id: walletD4.id }, data: { balance: newBal4 } })
    await prisma.walletHistory.create({
      data: {
        walletId: walletD4.id,
        userId: driver4.id,
        type: 'debit',
        amount: 200,
        balance: newBal4,
        description: 'Withdrawal (approved)',
        transactionType: 'withdrawal'
      }
    })
  }

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
  await prisma.driverService.create({ data: { driverId: driver4.id, serviceId: service1.id, status: 1 } })
  await prisma.driverService.create({ data: { driverId: driver5.id, serviceId: service2.id, status: 1 } })
  await prisma.driverService.create({ data: { driverId: driver6.id, serviceId: service1.id, status: 1 } })
  await prisma.driverService.create({ data: { driverId: driver7.id, serviceId: service3.id, status: 1 } })

  console.log('✅ Database seed completed successfully!')
  console.log('')
  console.log('📊 Summary:')
  console.log(`   - Settings: currency EGP (جنيه مصري), appName, distanceUnit`)
  console.log(`   - Payment methods: 4 (card, wallet, fawry, cash)`)
  console.log(`   - Regions: 2`)
  console.log(`   - Services: 3`)
  console.log(`   - Users: 12 (1 admin, 1 fleet, 4 riders, 7 drivers incl. 4 Egypt drivers)`)
  console.log(`   - Documents: 4`)
  console.log(`   - Coupons: 8 (slider offers)`)
  console.log(`   - Roles: 4 | Permissions: 15+`)
  console.log(`   - FAQs: 4`)
  console.log(`   - Ride Requests: 3`)
  console.log(`   - Payments: 1`)
  console.log(`   - Ratings: 2`)
  console.log(`   - Complaints: 1`)

  // Create Roles (for dashboard)
  console.log('Creating roles...')
  await prisma.role.createMany({
    data: [
      { name: 'admin', guardName: 'web' },
      { name: 'fleet', guardName: 'web' },
      { name: 'manager', guardName: 'web' },
      { name: 'support', guardName: 'web' }
    ]
  })

  // Create Permissions (for dashboard)
  console.log('Creating permissions...')
  const permUsers = await prisma.permission.create({
    data: { name: 'users', guardName: 'web' }
  })
  await prisma.permission.createMany({
    data: [
      { name: 'users.view', guardName: 'web', parentId: permUsers.id },
      { name: 'users.create', guardName: 'web', parentId: permUsers.id },
      { name: 'users.update', guardName: 'web', parentId: permUsers.id },
      { name: 'users.delete', guardName: 'web', parentId: permUsers.id }
    ]
  })
  const permRoles = await prisma.permission.create({
    data: { name: 'roles', guardName: 'web' }
  })
  await prisma.permission.createMany({
    data: [
      { name: 'roles.view', guardName: 'web', parentId: permRoles.id },
      { name: 'roles.create', guardName: 'web', parentId: permRoles.id },
      { name: 'roles.update', guardName: 'web', parentId: permRoles.id },
      { name: 'roles.delete', guardName: 'web', parentId: permRoles.id }
    ]
  })
  const permRides = await prisma.permission.create({
    data: { name: 'rides', guardName: 'web' }
  })
  await prisma.permission.createMany({
    data: [
      { name: 'rides.view', guardName: 'web', parentId: permRides.id },
      { name: 'rides.manage', guardName: 'web', parentId: permRides.id }
    ]
  })
  await prisma.permission.create({
    data: { name: 'settings', guardName: 'web' }
  })

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
      imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
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
      imageUrl: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800',
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
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
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
      image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0afe?w=800',
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
      image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800',
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
      image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800',
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
      image: 'https://images.unsplash.com/photo-1609520505218-7421df70c052?w=800',
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
      image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800',
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
      image: 'https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?w=800',
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
      image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800',
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

  // Create Dedicated Bookings (طلبات الحجز الخاص) — أسعار بالجنيه المصري
  console.log('Creating dedicated bookings...')
  const bookingDate1 = new Date('2026-03-10')
  const startTime1 = new Date('2026-03-10T09:00:00.000Z')
  await prisma.dedicatedBooking.create({
    data: {
      userId: rider1.id,
      driverId: driver1.id,
      vehicleCategoryId: regularCategory.id,
      pickupAddress: 'ميدان التحرير، القاهرة',
      pickupLat: 30.0444,
      pickupLng: 31.2357,
      dropoffAddress: 'مدينة نصر، القاهرة',
      dropoffLat: 30.0731,
      dropoffLng: 31.3456,
      bookingDate: bookingDate1,
      startTime: startTime1,
      durationHours: 4,
      pricingType: 'PER_HOUR',
      baseFare: 50,
      pricePerHour: 80,
      totalPrice: 370,
      status: 'COMPLETED',
      paymentStatus: 'CAPTURED',
      startedAt: startTime1,
      endedAt: new Date('2026-03-10T13:00:00.000Z'),
      notes: 'حجز سائق خاص لمدة 4 ساعات - القاهرة'
    }
  })

  const bookingDate2 = new Date('2026-03-15')
  const startTime2 = new Date('2026-03-15T10:00:00.000Z')
  await prisma.dedicatedBooking.create({
    data: {
      userId: rider2.id,
      driverId: driver2.id,
      vehicleCategoryId: mediumCategory.id,
      pickupAddress: 'المعادي، القاهرة',
      pickupLat: 29.9602,
      pickupLng: 31.2569,
      dropoffAddress: 'الشيخ زايد، 6 أكتوبر',
      dropoffLat: 30.0442,
      dropoffLng: 30.9765,
      bookingDate: bookingDate2,
      startTime: startTime2,
      durationHours: 6,
      pricingType: 'PER_HOUR',
      baseFare: 60,
      pricePerHour: 100,
      totalPrice: 660,
      status: 'ACTIVE',
      paymentStatus: 'PREAUTHORIZED',
      startedAt: startTime2,
      notes: 'نقل من المعادي إلى الشيخ زايد - نصف يوم'
    }
  })

  const bookingDate3 = new Date('2026-03-20')
  const startTime3 = new Date('2026-03-20T08:00:00.000Z')
  await prisma.dedicatedBooking.create({
    data: {
      userId: rider3.id,
      vehicleCategoryId: vipCategory.id,
      pickupAddress: 'مدينة نصر، القاهرة',
      pickupLat: 30.0731,
      pickupLng: 31.3456,
      dropoffAddress: 'الإسكندرية - الكورنيش',
      dropoffLat: 31.2001,
      dropoffLng: 29.9187,
      bookingDate: bookingDate3,
      startTime: startTime3,
      durationHours: 12,
      pricingType: 'PER_DAY',
      distanceKm: 220,
      numberOfDays: 1,
      baseFare: 200,
      pricePerHour: 150,
      totalPrice: 2500,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      notes: 'رحلة يوم كامل القاهرة - الإسكندرية (VIP)'
    }
  })

  await prisma.dedicatedBooking.create({
    data: {
      userId: rider1.id,
      driverId: driver1.id,
      vehicleCategoryId: regularCategory.id,
      pickupAddress: '6 أكتوبر، الجيزة',
      pickupLat: 30.0442,
      pickupLng: 30.9765,
      dropoffAddress: 'الهرم، الجيزة',
      dropoffLat: 29.9792,
      dropoffLng: 31.1342,
      bookingDate: new Date('2026-03-25'),
      startTime: new Date('2026-03-25T14:00:00.000Z'),
      durationHours: 2,
      pricingType: 'PER_HOUR',
      baseFare: 40,
      pricePerHour: 70,
      totalPrice: 180,
      status: 'DRIVER_ASSIGNED',
      paymentStatus: 'UNPAID',
      notes: 'جولة سريعة أكتوبر - الهرم'
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

  const adminNotifCount = await prisma.notification.count({ where: { notifiableType: 'Admin' } })
  if (adminNotifCount === 0) {
    console.log('Seeding sample admin notifications (header bell + /admin-notifications)...')
    await prisma.notification.createMany({
      data: [
        {
          type: 'new_ride',
          notifiableType: 'Admin',
          notifiableId: 0,
          data: {
            title: 'Sample: dashboard notifications',
            titleAr: 'عينة: إشعارات لوحة التحكم',
            message: 'You will see real alerts here (new drivers, PaySky webhooks, etc.).',
            messageAr: 'ستظهر هنا التنبيهات الحقيقية (سائقون جدد، PaySky، إلخ).',
            link: '/ride-requests',
          },
          isRead: false,
        },
        {
          type: 'new_driver',
          notifiableType: 'Admin',
          notifiableId: 0,
          data: {
            title: 'Sample: driver pending approval',
            titleAr: 'عينة: سائق بانتظار الموافقة',
            message: 'Open Drivers to review registrations.',
            messageAr: 'افتح السائقين لمراجعة التسجيلات.',
            link: '/drivers',
          },
          isRead: false,
        },
        {
          type: 'new_complaint',
          notifiableType: 'Admin',
          notifiableId: 0,
          data: {
            title: 'Sample: complaint',
            titleAr: 'عينة: شكوى',
            message: 'Complaints from riders/drivers appear here.',
            messageAr: 'تظهر هنا الشكاوى من الركاب أو السائقين.',
            link: '/complaints',
          },
          isRead: false,
        },
      ],
    })
  }

  console.log('')
  console.log('✅ Multi-service platform data seeded successfully!')
  console.log('   - Service Categories: 3 (Passenger, Cargo, Additional)')
  console.log('   - Vehicle Categories: 7 (Regular, Medium, VIP, Suzuki, Quarter Truck, 3-Ton, Jumbo)')
  console.log('   - Geographic Zones: 3')
  console.log('   - Pricing Rules: 7')
  console.log('   - Dedicated Bookings: 4 (طلبات الحجز الخاص - بالجنيه المصري)')
  console.log('   - Tourist Trips: 2')

  console.log('')
  console.log('🔑 Test Credentials:')
  console.log('   Admin: admin@alaelsareea.com / password123')
  console.log('   Fleet: fleet@alaelsareea.com / password123')
  console.log('   Rider: ahmed@example.com / password123')
  console.log('   Driver: khalid@example.com / password123')
  console.log('')
  console.log('💳 PaySky payment-test rides (completed, card, payment pending):')
  payTestRides.forEach((r, i) => {
    console.log(
      `   ${i + 1}. ride id=${r.id} | amount=${r.totalAmount} | riderId=${r.riderId} | driverId=${r.driverId}`
    )
  })
  console.log('   → Dashboard: /payments/paysky-test → «Simulate full trip payment» or real PaySky webhook.')
  console.log('')
  console.log('📱 Mobile API test user (for /apimobile/user/*):')
  console.log('   Phone: 01234567890')
  console.log('   Password: Test1234')
  console.log('   → Use POST /apimobile/user/auth/login with { "phone": "01234567890", "password": "Test1234" }')
  console.log('   → Then use the returned token in Authorization: Bearer <token> to test profile, wallet, bank-cards, booking, etc.')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

