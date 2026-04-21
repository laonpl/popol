import fs from 'fs';
const path = 'c:\\\\Users\\\\gudrb\\\\OneDrive\\\\바탕 화면\\\\코코네\\\\포폴\\\\backend\\\\src\\\\prompts\\\\experiencePrompts.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\\\\`/g, '`');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed backticks!');
