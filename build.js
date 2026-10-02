import {mkdir, copyFile} from 'node:fs/promises';

// Publish only browser assets; server.js is for local development.
const output=new URL('./dist/',import.meta.url);
await mkdir(output,{recursive:true});
for(const file of ['index.html','style.css','app.js','detector.js','motion.js','energy.js']){
  await copyFile(new URL(file,import.meta.url),new URL(file,output));
}
console.log('Static site built in dist/');
