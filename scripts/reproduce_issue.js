const { format } = require('date-fns');

console.log('--- Date Parsing Reproduction ---');

const dateStr = '2026-01-07'; // The "Today" from the user report

// 1. Current implementation style (implicitly UTC midnight for ISO date-only strings)
const dateUTC = new Date(dateStr);
console.log(`Input String: ${dateStr}`);
console.log(`new Date('${dateStr}') -> ISO: ${dateUTC.toISOString()}`);
console.log(`new Date('${dateStr}') -> Local: ${dateUTC.toString()}`);

// 2. format() behavior (uses local system time)
const formatted = format(dateUTC, 'yyyy-MM-dd');
console.log(`format(date, 'yyyy-MM-dd') -> ${formatted}`);

// Check if mismatch
if (formatted !== dateStr) {
    console.error('❌ MISMATCH DETECTED: Formatting shifted the date!');
} else {
    console.log('✅ Match: Date formatting preserved the day (System might be UTC or close to it).');
}

// 3. Proposed Fix: Construct as Local Midnight
const [y, m, d] = dateStr.split('-').map(Number);
const dateLocal = new Date(y, m - 1, d); // Month is 0-indexed
console.log(`\nProposed Fix (Local Construction): new Date(${y}, ${m-1}, ${d})`);
console.log(`Local Date -> ${dateLocal.toString()}`);
const formattedLocal = format(dateLocal, 'yyyy-MM-dd');
console.log(`format(localDate, 'yyyy-MM-dd') -> ${formattedLocal}`);

if (formattedLocal === dateStr) {
    console.log('✅ FIX VERIFIED: Local construction preserves the day in format().');
} else {
    console.error('❌ Fix Failed: Still mismatching.');
}
