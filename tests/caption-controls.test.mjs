import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
const {get}=await openApp();
await get('captionOpen').emit('click');assert.match(get('captionText').value,/示範資料/);
get('captionText').value='Edited draft';await get('captionClose').emit('click');await get('captionOpen').emit('click');assert.equal(get('captionText').value,'Edited draft');
get('captionLanguage').value='en';await get('captionGenerate').emit('click');assert.match(get('captionText').value,/Figure X/);
await get('captionCopy').emit('click');assert.match(get('captionMessage').textContent,/manual/);assert.equal(get('captionText').selected,true);
console.log('PASS: generate, English output, preserve edits, clipboard fallback');
