const fs = require('fs');
const content = fs.readFileSync('frontend/.next/static/chunks/9840.d872c3230daaab9b.js', 'utf8');
console.log('Size:', content.length);
const strMatches = content.match(/[A-Za-z0-9_]{4,}\.(?:tsx|ts|js|glb|png)/g) || [];
console.log('Unique file references:', [...new Set(strMatches)]);

const ids = content.match(/\/\*\*\*\/ ([0-9]+):/g) || [];
console.log('Module IDs count:', ids.length);
