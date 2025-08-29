import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 users
        { duration: '5m', target: 10 },   // Stay at 10 users
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '5m', target: 0 },    // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
        http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
        errors: ['rate<0.1'],              // Custom error rate below 10%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
    { email: 'test1@example.com', password: 'TestPassword123!' },
    { email: 'test2@example.com', password: 'TestPassword123!' },
    { email: 'test3@example.com', password: 'TestPassword123!' },
];

let authTokens = {};

export function setup() {
    console.log('Setting up load test...');

    // Create test users and get auth tokens
    testUsers.forEach((user, index) => {
        const registerResponse = http.post(`${BASE_URL}/api/auth/register`, {
            email: user.email,
            password: user.password,
            name: `Test User ${index + 1}`,
        });

        if (registerResponse.status === 201) {
            const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
                email: user.email,
                password: user.password,
            });

            if (loginResponse.status === 200) {
                const loginData = JSON.parse(loginResponse.body);
                authTokens[user.email] = loginData.access_token;
            }
        }
    });

    return { authTokens };
}

export default function (data) {
    const userIndex = __VU % testUsers.length;
    const user = testUsers[userIndex];
    const token = data.authTokens[user.email];

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // Test 1: Health Check
    const healthResponse = http.get(`${BASE_URL}/api/health`);
    check(healthResponse, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);

    // Test 2: User Profile
    const profileResponse = http.get(`${BASE_URL}/api/users/profile`, { headers });
    check(profileResponse, {
        'profile status is 200': (r) => r.status === 200,
        'profile response time < 1000ms': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);

    sleep(1);

    // Test 3: Create Room Scan Job
    const scanJobPayload = {
        frames: [
            'frame_001.jpg',
            'frame_002.jpg',
            'frame_003.jpg',
        ],
        imu_data: [
            { acceleration: { x: 0.1, y: 0.2, z: 9.8 } },
            { acceleration: { x: 0.0, y: 0.1, z: 9.9 } },
            { acceleration: { x: -0.1, y: 0.0, z: 9.7 } },
        ],
    };

    const scanResponse = http.post(
        `${BASE_URL}/api/rooms/scan`,
        JSON.stringify(scanJobPayload),
        { headers }
    );

    let jobId;
    const scanSuccess = check(scanResponse, {
        'scan job created': (r) => r.status === 201,
        'scan response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (scanSuccess) {
        const scanData = JSON.parse(scanResponse.body);
        jobId = scanData.job_id;
    } else {
        errorRate.add(1);
    }

    sleep(2);

    // Test 4: Check Job Status
    if (jobId) {
        const statusResponse = http.get(
            `${BASE_URL}/api/jobs/${jobId}/status`,
            { headers }
        );

        check(statusResponse, {
            'job status check successful': (r) => r.status === 200,
            'status response time < 500ms': (r) => r.timings.duration < 500,
        }) || errorRate.add(1);
    }

    sleep(1);

    // Test 5: Generate Layout
    const layoutPayload = {
        room_id: 'test_room_001',
        style_preferences: ['modern', 'minimalist'],
        budget_cents: 150000, // $1500
        constraints: {
            must_have: ['sofa', 'coffee_table'],
            avoid: ['large_furniture'],
        },
    };

    const layoutResponse = http.post(
        `${BASE_URL}/api/layouts/generate`,
        JSON.stringify(layoutPayload),
        { headers }
    );

    check(layoutResponse, {
        'layout generation initiated': (r) => r.status === 201,
        'layout response time < 3000ms': (r) => r.timings.duration < 3000,
    }) || errorRate.add(1);

    sleep(2);

    // Test 6: Search Products
    const searchPayload = {
        query: 'modern sofa',
        filters: {
            category: 'seating',
            price_range: { min: 50000, max: 200000 },
            style: ['modern'],
        },
        limit: 20,
    };

    const searchResponse = http.post(
        `${BASE_URL}/api/products/search`,
        JSON.stringify(searchPayload),
        { headers }
    );

    check(searchResponse, {
        'product search successful': (r) => r.status === 200,
        'search response time < 2000ms': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);

    sleep(1);

    // Test 7: Get User Rooms
    const roomsResponse = http.get(`${BASE_URL}/api/rooms`, { headers });

    check(roomsResponse, {
        'rooms list retrieved': (r) => r.status === 200,
        'rooms response time < 1000ms': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);

    sleep(1);

    // Test 8: WebSocket Connection Simulation (using SSE)
    const sseResponse = http.get(
        `${BASE_URL}/api/jobs/stream?job_id=${jobId || 'test'}`,
        {
            headers: {
                'Accept': 'text/event-stream',
                'Authorization': `Bearer ${token}`,
            },
            timeout: '5s',
        }
    );

    check(sseResponse, {
        'SSE connection established': (r) => r.status === 200,
        'SSE response time < 5000ms': (r) => r.timings.duration < 5000,
    }) || errorRate.add(1);

    sleep(2);
}

export function teardown(data) {
    console.log('Cleaning up load test...');

    // Clean up test users
    Object.keys(data.authTokens).forEach(email => {
        const token = data.authTokens[email];
        const headers = {
            'Authorization': `Bearer ${token}`,
        };

        http.del(`${BASE_URL}/api/users/profile`, { headers });
    });
}

// Scenario-specific tests
export const scenarios = {
    // Constant load test
    constant_load: {
        executor: 'constant-vus',
        vus: 20,
        duration: '10m',
        exec: 'constantLoadTest',
    },

    // Spike test
    spike_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '1m', target: 10 },
            { duration: '30s', target: 200 }, // Spike
            { duration: '1m', target: 10 },
        ],
        exec: 'spikeTest',
    },

    // Stress test
    stress_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '5m', target: 100 },
            { duration: '10m', target: 100 },
            { duration: '5m', target: 200 },
            { duration: '10m', target: 200 },
            { duration: '5m', target: 0 },
        ],
        exec: 'stressTest',
    },
};

export function constantLoadTest(data) {
    // Simplified test for constant load
    const token = Object.values(data.authTokens)[0];
    const headers = { 'Authorization': `Bearer ${token}` };

    const response = http.get(`${BASE_URL}/api/health`);
    check(response, {
        'constant load - health check OK': (r) => r.status === 200,
    });

    sleep(1);
}

export function spikeTest(data) {
    // Test critical endpoints during spike
    const token = Object.values(data.authTokens)[0];
    const headers = { 'Authorization': `Bearer ${token}` };

    const responses = http.batch([
        ['GET', `${BASE_URL}/api/health`],
        ['GET', `${BASE_URL}/api/users/profile`, null, { headers }],
        ['GET', `${BASE_URL}/api/rooms`, null, { headers }],
    ]);

    responses.forEach((response, index) => {
        check(response, {
            [`spike test - request ${index} successful`]: (r) => r.status < 400,
        });
    });

    sleep(0.5);
}

export function stressTest(data) {
    // Heavy load test
    const token = Object.values(data.authTokens)[0];
    const headers = { 'Authorization': `Bearer ${token}` };

    // Simulate heavy usage
    const searchPayload = {
        query: 'furniture',
        limit: 50,
    };

    const response = http.post(
        `${BASE_URL}/api/products/search`,
        JSON.stringify(searchPayload),
        { headers }
    );

    check(response, {
        'stress test - search under load': (r) => r.status === 200,
        'stress test - response time acceptable': (r) => r.timings.duration < 5000,
    });

    sleep(0.1); // Minimal sleep for stress
}
