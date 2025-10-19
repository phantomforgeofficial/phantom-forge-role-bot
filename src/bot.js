// src/bot.js


if (name === 'add-autorole') {
if (!ensureManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
const role = ix.options.getRole('rol', true);
if (!canManageRole(ix.guild, role, me)) return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));
const added = await addAutorole(ix.guild.id, role.id);
if (!added) return ix.reply(warn(`Rol **${role.name}** stond al in de autorole-lijst.`));
return ix.reply(ok(`Rol **${role.name}** toegevoegd aan de autorole-lijst.`));
}


if (name === 'remove-autorole') {
if (!ensureManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
const role = ix.options.getRole('rol', true);
const removed = await removeAutorole(ix.guild.id, role.id);
if (!removed) return ix.reply(warn(`Rol **${role.name}** stond niet in de autorole-lijst.`));
return ix.reply(ok(`Rol **${role.name}** verwijderd uit de autorole-lijst.`));
}


if (name === 'add-role') {
if (!ensureManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
const user = ix.options.getUser('gebruiker', true);
const role = ix.options.getRole('rol', true);
if (!canManageRole(ix.guild, role, me)) return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));
const member = await ix.guild.members.fetch(user.id).catch(() => null);
if (!member) return ix.reply(err('Gebruiker niet gevonden.'));
if (member.roles.cache.has(role.id)) return ix.reply(warn('Gebruiker heeft deze rol al.'));
await member.roles.add(role.id, `Toegevoegd door ${ix.user.tag}`);
return ix.reply(ok(`Rol **${role.name}** toegevoegd aan **${member.user.tag}**.`));
}


if (name === 'remove-role') {
if (!ensureManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
const user = ix.options.getUser('gebruiker', true);
const role = ix.options.getRole('rol', true);
if (!canManageRole(ix.guild, role, me)) return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));
const member = await ix.guild.members.fetch(user.id).catch(() => null);
if (!member) return ix.reply(err('Gebruiker niet gevonden.'));
if (!member.roles.cache.has(role.id)) return ix.reply(warn('Gebruiker heeft deze rol niet.'));
await member.roles.remove(role.id, `Verwijderd door ${ix.user.tag}`);
return ix.reply(ok(`Rol **${role.name}** verwijderd van **${member.user.tag}**.`));
}
} catch (e) {
console.error(e);
if (ix.isRepliable()) await ix.reply(err('Er ging iets mis.'));
}
});


client.login(process.env.DISCORD_TOKEN);
