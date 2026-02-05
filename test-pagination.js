#!/usr/bin/env node

/**
 * Transaction Pagination Test Suite
 * Tests pagination with large datasets (100+ transactions)
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'latanda-web3-secret-key-2024';

// Create a test token
function createTestToken(userId = 'test-user-123') {
    return jwt.sign(
        { id: userId, role: 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

// Make HTTP request
function makeRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test pagination
async function testPagination() {
    console.log('🧪 Starting Transaction Pagination Tests...\n');

    const token = createTestToken();
    const userId = 'test-user-123';
    let passed = 0;
    let failed = 0;

    try {
        // Test 1: Get first page
        console.log('Test 1: Get first page (20 items per page)');
        const page1 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 1,
            limit: 20
        }, token);

        if (page1.status === 200 && page1.body.success) {
            const { pagination, transactions } = page1.body.data;
            console.log(`  ✓ Status: ${page1.status}`);
            console.log(`  ✓ Page: ${pagination.current_page}/${pagination.total_pages}`);
            console.log(`  ✓ Total count: ${pagination.total_count}`);
            console.log(`  ✓ Transactions on page: ${transactions.length}`);
            console.log(`  ✓ Has next: ${pagination.has_next}`);
            passed++;
        } else {
            console.log(`  ✗ Failed: ${page1.status}`);
            failed++;
        }
        console.log();

        // Test 2: Get second page
        console.log('Test 2: Get second page');
        const page2 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 2,
            limit: 20
        }, token);

        if (page2.status === 200 && page2.body.success) {
            const { pagination, transactions } = page2.body.data;
            console.log(`  ✓ Page: ${pagination.current_page}/${pagination.total_pages}`);
            console.log(`  ✓ Transactions on page: ${transactions.length}`);
            console.log(`  ✓ Has previous: ${pagination.has_prev}`);
            passed++;
        } else {
            console.log(`  ✗ Failed: ${page2.status}`);
            failed++;
        }
        console.log();

        // Test 3: Different limit
        console.log('Test 3: Get page with limit=10');
        const page3 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 1,
            limit: 10
        }, token);

        if (page3.status === 200 && page3.body.success) {
            const { pagination } = page3.body.data;
            console.log(`  ✓ Limit: ${pagination.limit}`);
            console.log(`  ✓ Total pages with limit 10: ${pagination.total_pages}`);
            passed++;
        } else {
            console.log(`  ✗ Failed: ${page3.status}`);
            failed++;
        }
        console.log();

        // Test 4: With status filter
        console.log('Test 4: Get page with status filter (completed)');
        const page4 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 1,
            limit: 20,
            status_filter: 'completed'
        }, token);

        if (page4.status === 200 && page4.body.success) {
            const { pagination } = page4.body.data;
            console.log(`  ✓ Total with filter: ${pagination.total_count}`);
            console.log(`  ✓ Pages with filter: ${pagination.total_pages}`);
            passed++;
        } else {
            console.log(`  ✗ Failed: ${page4.status}`);
            failed++;
        }
        console.log();

        // Test 5: Invalid page number
        console.log('Test 5: Invalid page number (page 999)');
        const page5 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 999,
            limit: 20
        }, token);

        if (page5.status === 200) {
            const { transactions, pagination } = page5.body.data;
            console.log(`  ✓ Handles invalid page gracefully`);
            console.log(`  ✓ Empty results returned: ${transactions.length === 0}`);
            passed++;
        } else {
            console.log(`  ✗ Failed: ${page5.status}`);
            failed++;
        }
        console.log();

        // Test 6: Authentication check
        console.log('Test 6: Missing authentication token');
        const page6 = await makeRequest('POST', '/api/user/transactions', {
            user_id: userId,
            page: 1,
            limit: 20
        }, '');

        if (page6.status === 401 || page6.status === 403) {
            console.log(`  ✓ Correctly rejects unauthenticated request (${page6.status})`);
            passed++;
        } else {
            console.log(`  ✗ Failed: Should reject without auth`);
            failed++;
        }
        console.log();

    } catch (error) {
        console.error('✗ Test suite error:', error);
        failed++;
    }

    // Summary
    console.log('═'.repeat(50));
    console.log(`\n📊 Test Results:`);
    console.log(`  ✓ Passed: ${passed}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`\n${failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed'}\n`);

    process.exit(failed === 0 ? 0 : 1);
}

// Run tests
testPagination().catch(console.error);
