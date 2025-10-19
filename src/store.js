// src/store.js
import { promises as fs } from 'fs';
import path from 'path';


const FILE = path.resolve(process.cwd(), 'data', 'autoroles.json');


async function readDB() {
await fs.mkdir(path.dirname(FILE), { recursive: true });
try {
const raw = await fs.readFile(FILE, 'utf8');
return raw ? JSON.parse(raw) : {};
} catch (e) {
return {};
}
}


async function writeDB(db) {
await fs.mkdir(path.dirname(FILE), { recursive: true });
await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}


export async function listAutoroles(guildId) {
const db = await readDB();
return Array.isArray(db[guildId]?.autoroles) ? db[guildId].autoroles : [];
}


export async function addAutorole(guildId, roleId) {
const db = await readDB();
if (!db[guildId]) db[guildId] = { autoroles: [] };
if (db[guildId].autoroles.includes(roleId)) return false;
db[guildId].autoroles.push(roleId);
await writeDB(db);
return true;
}


export async function removeAutorole(guildId, roleId) {
const db = await readDB();
if (!db[guildId]) return false;
const before = db[guildId].autoroles.length;
db[guildId].autoroles = db[guildId].autoroles.filter(id => id !== roleId);
const changed = db[guildId].autoroles.length !== before;
if (changed) await writeDB(db);
return changed;
}
