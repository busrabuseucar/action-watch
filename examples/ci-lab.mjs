import assert from 'node:assert/strict';

// Isolated learning exercise. The actual application uses src/domain.ts.
const scenario=process.argv[2]??process.env.SCENARIO??'fixed';
if(!['broken','fixed'].includes(scenario))throw new Error('Choose broken or fixed.');
const isSuccessful=scenario==='broken' ? result=>result!=='failure' : result=>result==='success';
assert.equal(isSuccessful('success'),true);
assert.equal(isSuccessful('failure'),false);
assert.equal(isSuccessful('cancelled'),false,'Cancelled is not a successful result');
console.log('All three status checks passed.');
