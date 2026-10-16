// Optional local static-file server. No API, database, device connection or inference.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end('Bad request');return}
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
  try{const stat=await fs.stat(target);if(!stat.isFile())throw Error('Not a file');const real=await fs.realpath(target);if(!real.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}const data=await fs.readFile(real);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404);res.end('Not found')}
});
const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`红创科技演示：http://127.0.0.1:${port}\n仅静态文件，无后台 API。按 Ctrl+C 停止。`));
