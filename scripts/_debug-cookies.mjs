import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) { console.log('Missing env vars. URL:', !!url, 'Key:', !!key); process.exit(1); }

const s = createClient(url, key, { auth: { persistSession: false } });
const { data } = await s.from('integration_configs').select('settings').eq('provider','trade_republic').single();
const raw = Buffer.from(data.settings.session_cookies, 'base64').toString('utf-8');
console.log('Length:', raw.length, 'bytes');
console.log('First 300 chars:');
console.log(raw.substring(0, 300));
console.log('---');
console.log('Is Netscape:', raw.startsWith('# Netscape'));
console.log('Has tabs:', raw.includes('\t'));
