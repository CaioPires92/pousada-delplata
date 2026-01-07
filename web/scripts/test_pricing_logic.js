
const assert = require('assert');

// Simulate the logic in availability/route.ts
function checkDateInRange(targetDateStr, rangeStartStr, rangeEndStr) {
    // Logic: String comparison
    return targetDateStr >= rangeStartStr && targetDateStr <= rangeEndStr;
}

// Helper to simulate "checkIn" parsing
function parseCheckIn(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Local midnight construction
    return new Date(y, m - 1, d);
}

// Test Suite
console.log('--- Pricing & Date Logic Tests ---');

// Case 1: "Today" is 2026-01-07. Rate exists for 2026-01-07.
const todayStr = '2026-01-07';
const rateStart = '2026-01-07';
const rateEnd = '2026-01-07';

console.log(`Test 1: Today (${todayStr}) falls in rate [${rateStart}, ${rateEnd}]?`);
const result1 = checkDateInRange(todayStr, rateStart, rateEnd);
assert.strictEqual(result1, true, 'Should match exact date');
console.log('✅ Passed');

// Case 2: "Tomorrow" is 2026-01-08. Rate exists for 2026-01-08.
const tomorrowStr = '2026-01-08';
const rate2Start = '2026-01-08';
const rate2End = '2026-01-08';

console.log(`Test 2: Tomorrow (${tomorrowStr}) falls in rate [${rate2Start}, ${rate2End}]?`);
const result2 = checkDateInRange(tomorrowStr, rate2Start, rate2End);
assert.strictEqual(result2, true, 'Should match tomorrow');
console.log('✅ Passed');

// Case 3: Range Check
const target = '2026-01-05';
const rStart = '2026-01-01';
const rEnd = '2026-01-10';
console.log(`Test 3: Target (${target}) inside range [${rStart}, ${rEnd}]?`);
const result3 = checkDateInRange(target, rStart, rEnd);
assert.strictEqual(result3, true, 'Should match inside range');
console.log('✅ Passed');

// Case 4: Boundary Check (End)
console.log(`Test 4: Target (${rEnd}) is end of range [${rStart}, ${rEnd}]?`);
const result4 = checkDateInRange(rEnd, rStart, rEnd);
assert.strictEqual(result4, true, 'Should match end boundary');
console.log('✅ Passed');

console.log('\nAll tests passed successfully!');
