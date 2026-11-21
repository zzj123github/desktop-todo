import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res)=>{
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if(p==='/') p='/app/index.html';
  const f = path.join(root, p);
  fs.readFile(f,(e,d)=>{
    if(e){res.statusCode=404;res.end('not found');return;}
    res.setHeader('Content-Type', types[path.extname(f)]||'application/octet-stream');
    res.end(d);
  });
}).listen(8765,'127.0.0.1',()=>console.log('proto server up on 8765'));
