import Papa from 'papaparse';

// Test CSV functionality 
const testData = [
  { id: '1', title: 'Test Spark', status: 'SEEDLING', tags: 'test, example' },
  { id: '2', title: 'Another Spark', status: 'GROWING', tags: 'demo' }
];

const csv = Papa.unparse(testData, {
  header: true,
  delimiter: ',',
  quotes: true,
  skipEmptyLines: true
});

console.log('CSV Output:');
console.log(csv);

console.log('\nCSV test successful!');