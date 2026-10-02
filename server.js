import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/detector.js':'detector.js','/motion.js':'motion.js','/energy.js':'energy.js'};
http.createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try {const data=await readFile(new URL(file,import.meta.url));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(data);}
  catch {res.writeHead(500);res.end('Unable to load app');}
}).listen(3000,'0.0.0.0',()=>console.log('Stride running at http://localhost:3000'));
