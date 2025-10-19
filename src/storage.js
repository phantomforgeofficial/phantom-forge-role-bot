// src/storage.js
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Pad naar de JSON-opslag. Override met AUTOROLE_FILE in .env indien gewenst.
 * Voorbeeld: AUTOROLE_FILE=./storage/autoroles.json
 */
const FILE = path.resolve(
  process.cwd(),
  process.env.AUTOROLE_FILE || path.join('data', 'autoroles.json')
);

async function ensureDir() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
}

async function readDB() {
  await ensureDir();
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data ? data : {};
  } catch (e) {
    // Bestand bestaat nog niet of is ongeldig → start met lege db
    return {};
  }
}

async function writeDB(db) {
  await ensureDir();
  const json = JSON.stringify(db, null, 2);
  await fs.writeFile(FILE, json, 'utf8');
}

/**
 * Geeft een array met role-ids die automatisch worden toegekend bij join.
 * @param {string} guildId
 * @returns {Promise<string[]>}
 */
export async function listAutoroles(guildId) {
  const db = await readDB();
  const roles = db[guildId]?.autoroles;
  return Array.isArray(roles) ? roles : [];
}

/**
 * Voeg een role-id toe aan de autorole-lijst voor een guild.
 * @param {string} guildId
 * @param {string} roleId
 * @returns {Promise<boolean>} true als toegevoegd, false als bestond al
 */
export async function addAutorole(guildId, roleId) {
  const db = await readDB();
  if (!db[guildId]) db[guildId] = { autoroles: [] };

  const arr = db[guildId].autoroles;
  if (arr.includes(roleId)) return false;

  arr.push(roleId);
  await writeDB(db);
  return true;
}

/**
 * Verwijder een role-id uit de autorole-lijst voor een guild.
 * @param {string} guildId
 * @param {string} roleId
 * @returns {Promise<boolean>} true als verwijderd, false als niet aanwezig
 */
export async function removeAutorole(guildId, roleId) {
  const db = await readDB();
  if (!db[guildId]) return false;

  const before = db[guildId].autoroles.length;
  db[guildId].autoroles = db[guildId].autoroles.filter(id => id !== roleId);
  const changed = db[guildId].autoroles.length !== before;

  if (changed) await writeDB(db);
  return changed;
}
