// src/util.js
import { PermissionFlagsBits } from 'discord.js';


export function ok(msg) {
return { content: `✅ ${msg}`, ephemeral: true };
}
export function warn(msg) {
return { content: `⚠️ ${msg}`, ephemeral: true };
}
export function err(msg) {
return { content: `❌ ${msg}`, ephemeral: true };
}


export function canManageRole(guild, role, me) {
if (!role || !me) return false;
if (role.managed) return false; // integratie/Nitro
if (role.id === guild.id) return false; // @everyone
return me.roles.highest.position > role.position;
}


export function ensureManageRoles(member) {
return member.permissions.has(PermissionFlagsBits.ManageRoles);
}
