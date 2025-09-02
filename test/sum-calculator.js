const sum = Array.from({length: 100}, (_, i) => i + 1).reduce((a, b) => a + b, 0);
console.log('1到100的和:', sum);
require('fs').writeFileSync('sum-result.txt', sum.toString());