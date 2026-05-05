const fs = require('fs');

const collectionPath = process.argv[2] || 'POSTMAN\\OfferGo-API.postman_collection.json';
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

const jsonHeader = { key: 'Content-Type', value: 'application/json' };
const userAuth = { key: 'Authorization', value: 'Bearer {{userToken}}' };
const driverAuth = { key: 'Authorization', value: 'Bearer {{driverToken}}' };

function ensureVariable(key, value = '', type = 'string') {
  collection.variable = collection.variable || [];
  if (!collection.variable.some((v) => v.key === key)) {
    collection.variable.push({ key, value, type });
  }
}

function postmanUrl(rawUrl) {
  const withoutBase = rawUrl.replace(/^{{baseUrl}}\//, '');
  const [pathPart, queryString] = withoutBase.split('?');
  const parsed = {
    raw: rawUrl,
    host: ['{{baseUrl}}'],
    path: pathPart.split('/').filter(Boolean),
  };

  if (queryString) {
    parsed.query = queryString.split('&').map((pair) => {
      const [key, ...rest] = pair.split('=');
      return { key, value: rest.join('=') };
    });
  }

  return parsed;
}

function rawJsonBody(raw) {
  return {
    mode: 'raw',
    options: { raw: { language: 'json' } },
    raw,
  };
}

function body(value) {
  return rawJsonBody(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function request(name, method, rawUrl, headers = [], rawBody = null, description = '') {
  const item = {
    name,
    request: {
      method,
      header: headers,
      url: postmanUrl(rawUrl),
      description,
    },
    response: [],
  };

  if (rawBody !== null) {
    item.request.body = body(rawBody);
  }

  return item;
}

function withSaveDedicatedBookingId(item) {
  item.event = [
    {
      listen: 'test',
      script: {
        exec: [
          'var r = pm.response.json();',
          'if (r.success && r.data && r.data.id) {',
          "  pm.collectionVariables.set('dedicatedBookingId', r.data.id);",
          "  console.log('dedicatedBookingId saved:', r.data.id);",
          '}',
        ],
        type: 'text/javascript',
      },
    },
  ];
  return item;
}

ensureVariable('userId', '1');
ensureVariable('driverId', '7');
ensureVariable('vehicleCategoryId', '2');
ensureVariable('dedicatedBookingId', '12');

const dedicatedFolder = {
  name: '🚘 Dedicated Bookings (Mobile)',
  description:
    'Private/dedicated booking endpoints used by the mobile developer and dashboard page `/dedicated-bookings`. ' +
    'Run Pricing first, then Create Dedicated Booking to save `dedicatedBookingId` for the rest of the requests.',
  item: [
    {
      name: 'Pricing',
      item: [
        request(
          'Get Dedicated Booking Pricing',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings/pricing',
          [],
          null,
          'Use this in mobile before creating a dedicated booking to prefill baseFare and pricePerHour.'
        ),
        request(
          'Update Dedicated Booking Pricing (Admin)',
          'PUT',
          '{{baseUrl}}/api/dedicated-bookings/pricing',
          [jsonHeader, userAuth],
          {
            pricePerKm: 0,
            pricePerDay: 0,
            pricePerTrip: 0,
            baseFare: 100,
            pricePerHour: 75,
          }
        ),
      ],
    },
    {
      name: 'User / Rider',
      item: [
        withSaveDedicatedBookingId(
          request(
            'Create Dedicated Booking → saves dedicatedBookingId',
            'POST',
            '{{baseUrl}}/api/dedicated-bookings',
            [jsonHeader, userAuth],
            `{
  "userId": {{userId}},
  "vehicleCategoryId": {{vehicleCategoryId}},
  "pickupAddress": "Cairo Airport Terminal 3",
  "pickupLat": 30.1119,
  "pickupLng": 31.4139,
  "dropoffAddress": "Nile Ritz-Carlton, Cairo",
  "dropoffLat": 30.0459,
  "dropoffLng": 31.2326,
  "bookingDate": "2026-05-10",
  "startTime": "2026-05-10T09:00:00.000Z",
  "durationHours": 6,
  "baseFare": 100,
  "pricePerHour": 75,
  "notes": "Please wait near gate 4.",
  "promotionCode": ""
}`,
            'Creates a dedicated/private booking. Response may include clientSecret for payment confirmation.'
          )
        ),
        request(
          'List My Dedicated Bookings',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings?userId={{userId}}&page=1&limit=20',
          [userAuth]
        ),
        request(
          'Get Dedicated Booking Details',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}',
          [userAuth]
        ),
        request(
          'Cancel Dedicated Booking',
          'POST',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/cancel',
          [userAuth],
          null,
          'Cancels booking and applies the configured cancellation/refund flow.'
        ),
      ],
    },
    {
      name: 'Driver',
      item: [
        request(
          'List Available Dedicated Bookings',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings/available',
          [driverAuth],
          null,
          'Driver-only endpoint. Returns future PENDING/APPROVED bookings without an assigned driver.'
        ),
        withSaveDedicatedBookingId(
          request(
            'Accept Dedicated Booking → saves dedicatedBookingId',
            'POST',
            '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/accept',
            [driverAuth],
            null,
            'Driver-only endpoint. Assigns the current authenticated driver to the booking.'
          )
        ),
        request(
          'List My Assigned Dedicated Bookings',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings?driverId={{driverId}}&page=1&limit=20',
          [driverAuth]
        ),
        request(
          'Start Dedicated Booking Trip',
          'POST',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/start',
          [driverAuth]
        ),
        request(
          'End Dedicated Booking Trip',
          'POST',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/end',
          [driverAuth],
          null,
          'Completes the booking, captures payment if configured, and generates invoice.'
        ),
      ],
    },
    {
      name: 'Admin / Dashboard',
      item: [
        request(
          'List All Dedicated Bookings',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings?page=1&limit=100',
          [userAuth]
        ),
        request(
          'Filter Dedicated Bookings By Status',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings?status=PENDING&fromDate=2026-05-01&toDate=2026-05-31&page=1&limit=100',
          [userAuth]
        ),
        withSaveDedicatedBookingId(
          request(
            'Assign Driver To Dedicated Booking',
            'POST',
            '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/assign-driver',
            [jsonHeader, userAuth],
            `{
  "driverId": {{driverId}}
}`,
            'Admin/fleet protected endpoint.'
          )
        ),
        request(
          'Update Dedicated Booking Status',
          'PATCH',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/status',
          [jsonHeader, userAuth],
          { status: 'APPROVED' }
        ),
        request(
          'Delete Dedicated Booking',
          'DELETE',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}',
          [userAuth],
          null,
          'Cannot delete ACTIVE bookings.'
        ),
      ],
    },
    {
      name: 'Invoice',
      item: [
        request(
          'Get Dedicated Booking Invoice',
          'GET',
          '{{baseUrl}}/api/dedicated-bookings/{{dedicatedBookingId}}/invoice',
          [userAuth]
        ),
      ],
    },
  ],
};

collection.item = (collection.item || []).filter((item) => item.name !== dedicatedFolder.name);
collection.item.push(dedicatedFolder);

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log(`Updated ${collectionPath}`);
console.log(`Added folder: ${dedicatedFolder.name}`);
