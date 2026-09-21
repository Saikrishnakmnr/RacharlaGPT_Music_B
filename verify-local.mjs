import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const walk = d => fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
const files = walk(root);
const js = files.filter(x=>x.endsWith('.js'));
for (const f of js) execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
for (const f of files.filter(x=>x.endsWith('.json'))) JSON.parse(fs.readFileSync(f,'utf8'));
const bad = [];
for (const f of files.filter(x=>x.endsWith('.html'))) {
  const s=fs.readFileSync(f,'utf8');
  for (const m of s.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const v=m[1];
    if (/^(https?:|mailto:|tel:|#|javascript:)/.test(v) || v.includes('+') || v.includes('${')) continue;
    const target=path.join(root,v.replace(/^\//,''));
    if (!fs.existsSync(target)) bad.push(`${f}: ${v}`);
  }
}
if (bad.length) throw new Error('Missing local refs:\n'+bad.join('\n'));
const publicFiles=[...files.filter(x=>x.endsWith('.html')), ...files.filter(x=>x.startsWith(path.join(root,'js')) && x.endsWith('.js'))];
const forbidden=/APPWRITE_API_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|ADMIN_TOKEN/;
const leaks=publicFiles.filter(f=>forbidden.test(fs.readFileSync(f,'utf8')));
if (leaks.length) throw new Error('Secret names found in public files:\n'+leaks.join('\n'));
console.log('PASS: JavaScript syntax');
console.log('PASS: JSON syntax');
console.log('PASS: local HTML references');
console.log('PASS: public secret-name scan');
console.log('PASS: local verification complete');
