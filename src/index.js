// src/index.js
import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { addAutorole, removeAutorole, listAutoroles } from './storage.js';

/* =========================== Config =========================== */
const STATUS_CHANNEL_ID = '1429121620194234478'; // <- Jouw status-kanaal

/* =========================== Helpers ========================== */
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

function pad(n){ return String(n).padStart(2, '0'); }
function formatHMS(totalSeconds){
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function fmtDate(d = new Date()) {
  // Nederlands-achtige weergave; pas aan naar smaak
  return d.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/* ====================== Slash Commands Def ==================== */
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

/* ============================ Client ========================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

/* ===================== Presence helpers ====================== */
async function getGuildName() {
  const gid = process.env.GUILD_ID;
  if (gid) {
    const g = client.guilds.cache.get(gid) ?? await client.guilds.fetch(gid).catch(() => null);
    if (g) return g.name;
  }
  const first = client.guilds.cache.first();
  return first?.name || 'servers';
}
async function refreshPresence() {
  try {
    const name = await getGuildName();
    client.user?.setPresence({
      activities: [{ name, type: 3 }], // WATCHING
      status: 'online',
    });
  } catch (e) { console.error('presence error:', e); }
}

/* ================== Register commands on boot ================= */
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
      console.log('✅ Global commands geregistreerd (kan even duren)');
    }
  } catch (e) {
    console.error('❌ Fout bij registreren van commands:', e);
  }
}

/* ======================= Status Updater ======================= */
let statusInterval = null;
let statusMessageId = null;
const botStart = Date.now();

function buildStatusEmbed(guildName) {
  const uptime = formatHMS(process.uptime());
  const ping = Math.max(0, Math.round(client.ws.ping));
  const lastUpdate = fmtDate();

  return new EmbedBuilder()
    .setColor(0x7352FF)
    .setTitle('🕒 Phantom Forge Tickets Bot Status')
    .setDescription('')
    .addFields(
      { name: 'Active:', value: '✅ Online', inline: false },
      { name: 'Uptime', value: `\`${uptime}\``, inline: true },
      { name: 'Ping', value: `${ping} ms`, inline: true },
      { name: 'Last update', value: lastUpdate, inline: false },
    )
    .setFooter({ text: `Live updated every second | ${guildName}` });
}

async function startStatusLoop() {
  try {
    const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn('⚠️ Status-kanaal niet gevonden of niet tekst-gebaseerd.');
      return;
    }

    const guildName = await getGuildName();
    const embed = buildStatusEmbed(guildName);

    // Plaats of hergebruik bericht
    let msg = null;
    if (statusMessageId) {
      msg = await channel.messages.fetch(statusMessageId).catch(() => null);
    }
    if (!msg) {
      msg = await channel.send({ embeds: [embed] });
      statusMessageId = msg.id;
    } else {
      await msg.edit({ embeds: [embed] });
    }

    // Interval (elke seconde)
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(async () => {
      try {
        const gName = await getGuildName();
        const upd = buildStatusEmbed(gName);
        await msg.edit({ embeds: [upd] });
      } catch (e) {
        console.error('status update error:', e);
      }
    }, 1000);
  } catch (e) {
    console.error('startStatusLoop error:', e);
  }
}

/* =========================== Ready =========================== */
client.once('ready', async () => {
  console.log(`✅ Ingelogd als ${client.user.tag}`);
  await registerCommands();
  await refreshPresence();
  await startStatusLoop();
});
client.on('guildCreate', async () => { await refreshPresence(); });
client.on('guildDelete', async () => { await refreshPresence(); });

/* =================== Autorole on member join ================= */
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

/* ======================= Command handler ===================== */
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
        return;
    }
  } catch (e) {
    console.error('interaction error:', e);
    if (ix.isRepliable()) { try { await ix.reply(err('Er ging iets mis.')); } catch {} }
  }
});

/* ===================== Health server (Render) ================= */
const app = express();
app.get('/', (_req, res) => res.send('Discord role bot is running'));
app.get('/health', (_req, res) => res.status(200).send('ok'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Health server listening on ${PORT}`));

/* ============================ Login ========================== */
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN ontbreekt in .env');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
