# Tovo Backend

Node.js + Express backend API for Tovo taxi/ride-hailing management system with Prisma ORM and MySQL.

## Features

- RESTful API
- JWT Authentication
- MySQL Database with Prisma ORM
- User Management (Riders, Drivers, Admins, Fleet)
- Ride Request Management
- Payment & Wallet System
- Service Management
- Zone Management
- Airport Management
- SOS (Emergency Contacts)
- Driver Documents
- Withdraw Requests
- Complaints & Comments
- Ratings & Reviews
- Coupons
- FAQs
- Settings Management
- Google Maps Integration (Places API, Roads API)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="mysql://user:password@localhost:3306/driverproject"

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# Google Maps API (for Places and Roads APIs)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE driverproject;
```

2. Generate Prisma Client:
```bash
npm run prisma:generate
```

3. Run migrations to create tables:
```bash
npm run prisma:migrate
```

Or push schema directly (for development):
```bash
npm run prisma:push
```

4. (Optional) Open Prisma Studio to view/edit data:
```bash
npm run prisma:studio
```

### Development

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### Production

```bash
npm start
```

## Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and run migrations
- `npm run prisma:push` - Push schema changes to database (dev only)
- `npm run prisma:studio` - Open Prisma Studio GUI

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register rider
- `POST /api/auth/driver-register` - Register driver
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forget-password` - Forget password
- `POST /api/auth/social-login` - Social login

### Users
- `GET /api/users/list` - Get user list
- `GET /api/users/detail` - Get user detail
- `POST /api/users/update-profile` - Update profile
- `POST /api/users/change-password` - Change password
- `POST /api/users/update-user-status` - Update online/available status
- `POST /api/users/delete-user-account` - Delete account
- `GET /api/users/get-appsetting` - Get app settings

### Ride Requests
- `POST /api/ride-requests/save-riderequest` - Create ride request
- `GET /api/ride-requests/riderequest-list` - Get ride requests
- `GET /api/ride-requests/riderequest-detail` - Get ride request detail
- `POST /api/ride-requests/riderequest-update/:id` - Update ride request
- `POST /api/ride-requests/riderequest-delete/:id` - Delete ride request
- `POST /api/ride-requests/riderequest-respond` - Accept/Reject ride
- `POST /api/ride-requests/complete-riderequest` - Complete ride
- `POST /api/ride-requests/riderequest/:id/drop/:index` - Update drop location
- `POST /api/ride-requests/verify-coupon` - Verify coupon
- `POST /api/ride-requests/apply-bid` - Apply bid
- `POST /api/ride-requests/get-bidding-riderequest` - Get bidding drivers
- `POST /api/ride-requests/riderequest-bid-respond` - Accept bid
- `POST /api/ride-requests/save-ride-rating` - Rate ride

### Services
- `GET /api/services/service-list` - Get services
- `POST /api/services/estimate-price-time` - Estimate price

### Payments
- `POST /api/payments/save-payment` - Save payment
- `POST /api/payments/earning-list` - Get earnings

### Wallets
- `GET /api/wallets/wallet-detail` - Get wallet
- `POST /api/wallets/save-wallet` - Add money to wallet
- `GET /api/wallets/wallet-list` - Get wallet history
- `GET /api/wallets/reward-list` - Get reward history

### Dashboard
- `GET /api/dashboard/admin-dashboard` - Admin dashboard stats
- `GET /api/dashboard/rider-dashboard` - Rider dashboard stats
- `GET /api/dashboard/current-riderequest` - Get current ride request
- `GET /api/dashboard/appsetting` - Get app settings

### Driver Documents
- `GET /api/driver-documents/driver-document-list` - Get driver documents
- `POST /api/driver-documents/driver-document-save` - Save driver document
- `POST /api/driver-documents/driver-document-update/:id` - Update document
- `POST /api/driver-documents/driver-document-delete/:id` - Delete document

### Documents
- `GET /api/documents/document-list` - Get document list

### SOS
- `GET /api/sos/sos-list` - Get SOS contacts
- `POST /api/sos/save-sos` - Save SOS contact
- `POST /api/sos/sos-update/:id` - Update SOS contact
- `POST /api/sos/sos-delete/:id` - Delete SOS contact
- `POST /api/sos/admin-sos-notify` - Notify admin of SOS

### Withdraw Requests
- `GET /api/withdraw-requests/withdrawrequest-list` - Get withdraw requests
- `POST /api/withdraw-requests/save-withdrawrequest` - Create withdraw request
- `POST /api/withdraw-requests/update-status/:id` - Update withdraw status

### Complaints
- `POST /api/complaints/save-complaint` - Save complaint
- `POST /api/complaints/update-complaint/:id` - Update complaint

### Complaint Comments
- `GET /api/complaint-comments/complaintcomment-list` - Get comments
- `POST /api/complaint-comments/save-complaintcomment` - Save comment
- `POST /api/complaint-comments/update-complaintcomment/:id` - Update comment

### Coupons
- `GET /api/coupons/coupon-list` - Get coupon list

### Additional Fees
- `GET /api/additional-fees/additional-fees-list` - Get additional fees

### Payment Gateways
- `GET /api/payment-gateways/payment-gateway-list` - Get payment gateways

### Settings
- `GET /api/settings/get-setting` - Get settings
- `POST /api/settings/save-setting` - Save settings
- `GET /api/settings/get-appsetting` - Get app settings
- `POST /api/settings/update-appsetting` - Update app settings

### Airports
- `GET /api/airports/airport-list` - Get airport list
- `POST /api/airports/airport-save` - Save airport
- `POST /api/airports/airport-delete/:id` - Delete airport
- `POST /api/airports/airport-action` - Airport action

### FAQs
- `GET /api/faqs/faq-list` - Get FAQ list

### Cancellations
- `GET /api/cancellations/cancelReason-list` - Get cancellation reasons

### References
- `GET /api/references/reference-list` - Get referral references

### Manage Zones
- `GET /api/manage-zones/managezone-list` - Get zone list
- `POST /api/manage-zones/managezone-save` - Save zone
- `POST /api/manage-zones/managezone-delete/:id` - Delete zone

### Utilities
- `GET /api/utilities/near-by-driver` - Get nearby drivers
- `GET /api/utilities/language-table-list` - Get language tables
- `GET /api/utilities/place-autocomplete-api` - Google Places autocomplete
- `GET /api/utilities/place-detail-api` - Google Places detail
- `POST /api/utilities/snap-to-roads` - Google Roads snap to roads

### Notifications
- `POST /api/notifications/notification-list` - Get notifications

## Database Schema

The project uses Prisma ORM with MySQL. The schema includes:

- **Users** - Riders, Drivers, Admins, Fleet
- **RideRequests** - Ride booking and management
- **Services** - Service types (Economy, Premium, etc.)
- **Payments** - Payment transactions
- **Wallets** - User wallets and transaction history
- **Coupons** - Discount coupons
- **Documents** - Driver documents
- **DriverDocuments** - Driver document uploads
- **Complaints** - User complaints
- **ComplaintComments** - Complaint comments
- **Ratings** - Ride ratings
- **Bids** - Ride request bids
- **SOS** - Emergency contacts
- **WithdrawRequests** - Withdrawal requests
- **Airports** - Airport locations
- **FAQs** - Frequently asked questions
- **Cancellations** - Cancellation reasons
- **ManageZones** - Zone management
- **ZonePrices** - Zone pricing
- **SurgePrices** - Surge pricing
- **AdditionalFees** - Additional fees
- **PaymentGateways** - Payment gateway configurations
- **Settings** - Application settings
- **AppSettings** - App-specific settings
- **Notifications** - User notifications
- **Regions** - Service regions
- **DriverServices** - Driver service associations
- **Reviews** - User reviews
- **CustomerSupport** - Customer support tickets
- **SupportChathistory** - Support chat history
- **PushNotifications** - Push notification records

See `prisma/schema.prisma` for the complete schema definition.
