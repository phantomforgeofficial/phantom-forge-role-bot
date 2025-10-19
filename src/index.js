// src/index.js
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { addAutorole, removeAutorole, listAutoroles } from './storage.js';

/* ------------------------- Helpers ------------------------- */
const ok   = (m) => ({ content: `✅ ${m}`, ephemeral: true });
const warn = (m) => ({ content: `⚠️ ${m}`, ephemeral: true });
const err  = (m) => ({ content: `❌ ${m}`, ephemeral: true });

function canManageRole(guild, role, meMember) {
  if (!role || !meMember) return false;
  if (role.managed) return false;          // integratie/Nitro
  if (role.id === guild.id) return false;  // @everyone
  return meMember.roles.highest.position > role.position;
}

const needManageRoles = (member) =>
  member.permissions.has(PermissionFlagsBits.ManageRoles);

/* --------------------- Slash Commands Def ------------------ */
const slashCommands = [
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

/* ------------------------ Client --------------------------- */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

/* ------------- Register commands on startup ---------------- */
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  if (!process.env.CLIENT_ID) {
    console.error('❌ CLIENT_ID ontbreekt in .env');
    return;
  }
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: slashCommands }
      );
      console.log('✅ Guild commands geregistreerd');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: slashCommands }
      );
      console.log('✅ Global commands geregistreerd (kan even duren om te verschijnen)');
    }
  } catch (e) {
    console.error('❌ Fout bij registreren van commands:', e);
  }
}

/* -------------------------- Ready -------------------------- */
client.once('ready', async () => {
  console.log(`✅ Ingelogd als ${client.user.tag}`);
  client.user?.setPresence({
    activities: [{ name: 'roles beheren', type: 3 }], // Watching
    status: 'online',
  });
  await registerCommands();
});

/* --------------- Autorole on member join ------------------- */
client.on('guildMemberAdd', async (member) => {
  try {
    const roles = await listAutoroles(member.guild.id);
    if (!roles?.length) return;

    const me = await member.guild.members.fetchMe();
    const assignable = roles
      .map(id => member.guild.roles.cache.get(id))
      .filter(r => r && canManageRole(member.guild, r, me));

    if (!assignable.length) return;
    await member.roles.add(assignable.map(r => r.id), 'Autorole bij join');
  } catch (e) {
    console.error('autorole join error:', e);
  }
});

/* --------------------- Command handler --------------------- */
client.on('interactionCreate', async (ix) => {
  try {
    if (!ix.isChatInputCommand()) return;
    if (!ix.guild) return ix.reply(err('Alleen in servers.'));

    const me = await ix.guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return ix.reply(err('Ik mis **Manage Roles** permissie.'));
    }

    const invoker = await ix.guild.members.fetch(ix.user.id);

    switch (ix.commandName) {
      case 'add-autorole': {
        if (!needManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
        const role = ix.options.getRole('rol', true);
        if (!canManageRole(ix.guild, role, me))
          return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));

        const added = await addAutorole(ix.guild.id, role.id);
        if (!added) return ix.reply(warn(`Rol **${role.name}** stond al in de autorole-lijst.`));
        return ix.reply(ok(`Rol **${role.name}** toegevoegd aan de autorole-lijst.`));
      }

      case 'remove-autorole': {
        if (!needManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
        const role = ix.options.getRole('rol', true);
        const removed = await removeAutorole(ix.guild.id, role.id);
        if (!removed) return ix.reply(warn(`Rol **${role.name}** stond niet in de autorole-lijst.`));
        return ix.reply(ok(`Rol **${role.name}** verwijderd uit de autorole-lijst.`));
      }

      case 'add-role': {
        if (!needManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
        const user = ix.options.getUser('gebruiker', true);
        const role = ix.options.getRole('rol', true);

        if (!canManageRole(ix.guild, role, me))
          return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));

        const member = await ix.guild.members.fetch(user.id).catch(() => null);
        if (!member) return ix.reply(err('Gebruiker niet gevonden.'));
        if (member.roles.cache.has(role.id)) return ix.reply(warn('Gebruiker heeft deze rol al.'));

        await member.roles.add(role.id, `Toegevoegd door ${ix.user.tag}`);
        return ix.reply(ok(`Rol **${role.name}** toegevoegd aan **${member.user.tag}**.`));
      }

      case 'remove-role': {
        if (!needManageRoles(invoker)) return ix.reply(err('Je mist **Manage Roles**.'));
        const user = ix.options.getUser('gebruiker', true);
        const role = ix.options.getRole('rol', true);

        if (!canManageRole(ix.guild, role, me))
          return ix.reply(err('Ik kan deze rol niet beheren (hiërarchie/managed).'));

        const member = await ix.guild.members.fetch(user.id).catch(() => null);
        if (!member) return ix.reply(err('Gebruiker niet gevonden.'));
        if (!member.roles.cache.has(role.id)) return ix.reply(warn('Gebruiker heeft deze rol niet.'));

        await member.roles.remove(role.id, `Verwijderd door ${ix.user.tag}`);
        return ix.reply(ok(`Rol **${role.name}** verwijderd van **${member.user.tag}**.`));
      }

      default:
        return; // andere commands negeren
    }
  } catch (e) {
    console.error('interaction error:', e);
    if (ix.isRepliable()) {
      try { await ix.reply(err('Er ging iets mis.')); } catch {}
    }
  }
});

// --- Klein health/keepalive servertje (voor Render Web Service) ---
import express from 'express';

const app = express();
app.get('/', (_req, res) => res.send('Discord role bot is running'));
app.get('/health', (_req, res) => res.status(200).send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

/* -------------------------- Login -------------------------- */
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN ontbreekt in .env');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
