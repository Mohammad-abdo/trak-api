import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

const runVerification = async () => {
    console.log('🚀 Starting System Verification...\n');

    try {
        // 1. Verify Service Categories
        console.log('1️⃣  Testing Service Categories...');
        const services = await axios.get(`${API_URL}/service-categories`);
        if (services.data.success) {
            console.log(`✅ Default Service Categories found: ${services.data.data.length}`);
            services.data.data.forEach(s => console.log(`   - ${s.name} (${s.slug})`));
        } else {
            console.error('❌ Failed to fetch service categories');
        }

        // 2. Verify Vehicle Categories
        console.log('\n2️⃣  Testing Vehicle Categories...');
        const vehicles = await axios.get(`${API_URL}/vehicle-categories`);
        if (vehicles.data.success) {
            console.log(`✅ Default Vehicle Categories found: ${vehicles.data.data.length}`);
            const sampleVehicle = vehicles.data.data[0];
            if (sampleVehicle) {
                console.log(`   Sample: ${sampleVehicle.name} (Capacity: ${sampleVehicle.capacity})`);
                // Store ID for price test
                await testPriceCalculation(sampleVehicle.id);
            } else {
                console.warn('   ⚠️ No vehicle categories found to test pricing with.');
            }
        } else {
            console.error('❌ Failed to fetch vehicle categories');
        }

        // 4. Verify Geographic Zones
        console.log('\n4️⃣  Testing Geographic Zones...');
        const zones = await axios.get(`${API_URL}/geographic-zones`);
        if (zones.data.success) {
            console.log(`✅ Zones found: ${zones.data.data.length}`);
            if (zones.data.data.length > 0) {
                const zone = zones.data.data[0];
                console.log(`   Sample Zone: ${zone.name} (Radius: ${zone.radius}km)`);

                // Test Smart Search in this zone
                await testSmartSearch(zone.centerLat, zone.centerLng);
            } else {
                console.warn('   ⚠️ No geographic zones found to test smart search.');
            }
        } else {
            console.error('❌ Failed to fetch zones');
        }

    } catch (error) {
        console.error('\n❌ Verification Failed:', error.message);
        if (error.code) console.error('Error Code:', error.code);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

const testPriceCalculation = async (vehicleId) => {
    console.log('\n3️⃣  Testing Dynamic Pricing Engine...');
    try {
        const payload = {
            vehicleCategoryId: vehicleId,
            distance: 10, // 10km trip
            duration: 20  // 20min trip
        };

        // Note: We use the estimate endpoint on service controller which now supports vehicleCategoryId
        const response = await axios.post(`${API_URL}/services/estimate-price-time`, payload);

        if (response.data.success) {
            const breakdown = response.data.data.breakdown;
            console.log('✅ Price Calculation Successful!');
            console.log(`   Trip: 10km, 20min`);
            console.log(`   Total Amount: ${response.data.data.estimatedPrice} SAR`);
            if (breakdown) {
                console.log('   --- Breakdown ---');
                console.log(`   Base Fare: ${breakdown.baseFare} (for first ${breakdown.baseDistance}km)`);
                console.log(`   Distance Charge: ${breakdown.distanceCharge} (${breakdown.extraDistance}km x ${breakdown.perKmRate})`);
                console.log(`   Time Charge: ${breakdown.timeCharge}`);
                console.log(`   Minimum Fare Applied: ${breakdown.appliedMessage}`);
            }
        }
    } catch (error) {
        console.error('❌ Price Calculation Failed:', error.message);
        if (error.response) console.error(error.response.data);
    }
};

const testSmartSearch = async (lat, lng) => {
    console.log('\n5️⃣  Testing Smart Vehicle Search...');
    try {
        const payload = {
            latitude: lat,
            longitude: lng
        };

        const response = await axios.post(`${API_URL}/vehicle-categories/available`, payload);

        if (response.data.success) {
            // Logic update: controller returns 'data', not 'categories'
            const categories = response.data.data || [];
            console.log(`✅ Search Successful at [${lat}, ${lng}]`);
            console.log(`   Found: ${categories.length} categories`);
            categories.forEach(c => {
                console.log(`   - ${c.name} (Matched Zone: N/A)`);
            });
        } else {
            console.warn('⚠️ Search response success false:', response.data);
        }
    } catch (error) {
        console.error('❌ Smart Search Failed:', error.message);
        if (error.response) console.error(error.response.data);
    }
};

runVerification();
