const fs = require('fs');
const trace = JSON.parse(fs.readFileSync('evidence/perf-profile/trace_production_single.json', 'utf8'));

console.log('Total trace events:', trace.length);
const longEvents = trace.filter(e => e.dur && e.dur > 50000);
console.log('Events with dur > 50ms:', longEvents.length);

const top15 = longEvents.sort((a,b) => b.dur - a.dur).slice(0, 15);
top15.forEach((e, idx) => {
  console.log(`#${idx+1}: name=${e.name}, cat=${e.cat}, dur=${(e.dur/1000).toFixed(1)}ms, pid=${e.pid}, tid=${e.tid}`);
  if (e.args) {
    console.log('   args:', JSON.stringify(e.args).substring(0, 300));
  }
});
