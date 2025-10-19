// src/register-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';


const commands = [
new SlashCommandBuilder()
.setName('add-autorole')
.setDescription('Voegt een rol toe die automatisch wordt gegeven bij joinen')
.addRoleOption(o => o.setName('rol').setDescription('Kies de rol').setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),


new SlashCommandBuilder()
.setName('remove-autorole')
.setDescription('Verwijdert een rol uit de autorole-lijst')
.addRoleOption(o => o.setName('rol').setDescription('Kies de rol').setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),


new SlashCommandBuilder()
.setName('add-role')
.setDescription('Voegt een rol toe aan een gebruiker')
.addUserOption(o => o.setName('gebruiker').setDescription('Kies de gebruiker').setRequired(true))
.addRoleOption(o => o.setName('rol').setDescription('Kies de rol').setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),


new SlashCommandBuilder()
.setName('remove-role')
.setDescription('Verwijdert een rol van een gebruiker')
.addUserOption(o => o.setName('gebruiker').setDescription('Kies de gebruiker').setRequired(true))
.addRoleOption(o => o.setName('rol').setDescription('Kies de rol').setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
].map(c => c.toJSON());


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);


async function main() {
try {
if (process.env.GUILD_ID) {
await rest.put(
Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
{ body: commands }
);
console.log('✅ Guild commands geregistreerd');
} else {
await rest.put(
Routes.applicationCommands(process.env.CLIENT_ID),
{ body: commands }
);
console.log('✅ Global commands geregistreerd (kan ~1u duren)');
}
} catch (e) {
console.error('❌ Fout bij registreren:', e);
}
}


main();
