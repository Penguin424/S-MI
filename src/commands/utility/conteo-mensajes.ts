import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  Message,
  Collection,
  AttachmentBuilder,
} from "discord.js";

interface UserMessageData {
  usuario: string;
  userId: string;
  mensajes: {
    tipo: "texto" | "media" | "voz";
    contenido: string;
    canal: string;
    fecha: string;
  }[];
  total: number;
  totalTexto: number;
  totalMedia: number;
  totalVoz: number;
}

function classifyMessage(msg: Message): "texto" | "media" | "voz" {
  // Voice messages have a specific flag
  if (msg.flags.has("IsVoiceMessage")) {
    return "voz";
  }
  // Media: attachments (images, videos, files), embeds with images/videos, stickers
  if (
    msg.attachments.size > 0 ||
    msg.stickers.size > 0 ||
    msg.embeds.some((e) => e.image || e.video || e.thumbnail)
  ) {
    return "media";
  }
  return "texto";
}

async function fetchAllMessages(
  channel: TextChannel,
  after: Date,
  before: Date,
): Promise<Message[]> {
  const messages: Message[] = [];
  let lastId: string | undefined;

  // Convert 'after' date to a snowflake to use as 'after' parameter
  const afterSnowflake = dateToSnowflake(after);

  while (true) {
    const options: { limit: number; after?: string } = {
      limit: 100,
      after: lastId ?? afterSnowflake,
    };

    const fetched: Collection<string, Message> =
      await channel.messages.fetch(options);

    if (fetched.size === 0) break;

    // Filter messages within the date range
    const filtered = fetched.filter(
      (m) => m.createdAt >= after && m.createdAt <= before && !m.author.bot,
    );

    messages.push(...filtered.values());

    // If we got fewer than 100, we've reached the end
    if (fetched.size < 100) break;

    // The last message (highest ID) for pagination
    lastId = fetched.first()!.id; // .first() returns highest ID when fetched with 'after'

    // If the newest message is beyond our 'before' date, stop
    const newest = fetched.first()!;
    if (newest.createdAt > before) {
      // We still collected the valid ones, but check if we should stop
      const oldest = fetched.last()!;
      if (oldest.createdAt > before) break;
    }
  }

  return messages;
}

function dateToSnowflake(date: Date): string {
  const discordEpoch = 1420070400000n;
  const timestamp = BigInt(date.getTime()) - discordEpoch;
  return (timestamp << 22n).toString();
}

export default {
  data: new SlashCommandBuilder()
    .setName("conteo-mensajes-servidor")
    .setDescription(
      "Cuenta los mensajes de todos los canales de texto en un rango de tiempo",
    )
    .addIntegerOption((option) =>
      option
        .setName("dias")
        .setDescription("Rango de días hacia atrás desde hoy (default: 7)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365),
    )
    .addStringOption((option) =>
      option
        .setName("desde")
        .setDescription(
          "Fecha inicio (YYYY-MM-DD). Tiene prioridad sobre 'dias'",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("hasta")
        .setDescription("Fecha fin (YYYY-MM-DD). Default: hoy")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply("Este comando solo funciona en un servidor.");
      return;
    }

    // Parse date range
    const desdeStr = interaction.options.getString("desde");
    const hastaStr = interaction.options.getString("hasta");
    const dias = interaction.options.getInteger("dias") ?? 7;

    let after: Date;
    let before: Date;

    if (desdeStr) {
      after = new Date(desdeStr + "T00:00:00");
      if (isNaN(after.getTime())) {
        await interaction.editReply(
          "Fecha 'desde' inválida. Usa el formato YYYY-MM-DD.",
        );
        return;
      }
    } else {
      after = new Date();
      after.setDate(after.getDate() - dias);
      after.setHours(0, 0, 0, 0);
    }

    if (hastaStr) {
      before = new Date(hastaStr + "T23:59:59");
      if (isNaN(before.getTime())) {
        await interaction.editReply(
          "Fecha 'hasta' inválida. Usa el formato YYYY-MM-DD.",
        );
        return;
      }
    } else {
      before = new Date();
    }

    if (after >= before) {
      await interaction.editReply(
        "La fecha 'desde' debe ser anterior a la fecha 'hasta'.",
      );
      return;
    }

    // Get all text channels from all categories
    const textChannels = guild.channels.cache.filter(
      (ch): ch is TextChannel =>
        ch.type === ChannelType.GuildText && ch.parentId !== null,
    );

    const usersMap = new Map<string, UserMessageData>();
    let totalScanned = 0;
    let channelsScanned = 0;

    for (const [, channel] of textChannels) {
      try {
        const messages = await fetchAllMessages(channel, after, before);
        totalScanned += messages.length;
        channelsScanned++;

        for (const msg of messages) {
          const tipo = classifyMessage(msg);
          const userId = msg.author.id;

          if (!usersMap.has(userId)) {
            usersMap.set(userId, {
              usuario: msg.author.username,
              userId,
              mensajes: [],
              total: 0,
              totalTexto: 0,
              totalMedia: 0,
              totalVoz: 0,
            });
          }

          const userData = usersMap.get(userId)!;
          userData.mensajes.push({
            tipo,
            contenido:
              tipo === "media"
                ? `[${msg.attachments.size} archivo(s)]${msg.content ? " " + msg.content : ""}`
                : tipo === "voz"
                  ? "[Mensaje de voz]"
                  : msg.content.substring(0, 200),
            canal: channel.name,
            fecha: msg.createdAt.toISOString(),
          });

          userData.total++;
          if (tipo === "texto") userData.totalTexto++;
          else if (tipo === "media") userData.totalMedia++;
          else if (tipo === "voz") userData.totalVoz++;
        }
      } catch (err) {
        console.error(`No se pudo leer el canal #${channel.name}: ${err}`);
      }
    }

    // Build the summary JSON
    const resumen = {
      servidor: guild.name,
      periodo: {
        desde: after.toISOString().split("T")[0],
        hasta: before.toISOString().split("T")[0],
      },
      canalesEscaneados: channelsScanned,
      totalMensajes: totalScanned,
      usuarios: Array.from(usersMap.values())
        .sort((a, b) => b.total - a.total)
        .map((u) => ({
          usuario: u.usuario,
          userId: u.userId,
          total: u.total,
          totalTexto: u.totalTexto,
          totalMedia: u.totalMedia,
          totalVoz: u.totalVoz,
          mensajes: u.mensajes,
        })),
    };

    const jsonString = JSON.stringify(resumen, null, 2);

    // Find the "prueba de comandos" channel in "desarrollo" category
    const targetChannel = guild.channels.cache.find((ch) => {
      if (ch.type !== ChannelType.GuildText) return false;
      const parent = ch.parent;
      if (!parent) return false;
      return (
        ch.name.toLowerCase().includes("prueba") &&
        ch.name.toLowerCase().includes("comando") &&
        parent.name.toLowerCase().includes("desarrollo")
      );
    }) as TextChannel | undefined;

    const sendChannel = targetChannel ?? (interaction.channel as TextChannel);

    // Send as a file attachment since JSON can be large
    const attachment = new AttachmentBuilder(Buffer.from(jsonString), {
      name: `conteo-mensajes-${after.toISOString().split("T")[0]}_${before.toISOString().split("T")[0]}.json`,
    });

    // Build a compact summary for the message
    const top5 = resumen.usuarios.slice(0, 5);
    const summaryText = [
      `## 📊 Conteo de Mensajes`,
      `**Periodo:** ${resumen.periodo.desde} → ${resumen.periodo.hasta}`,
      `**Canales escaneados:** ${resumen.canalesEscaneados}`,
      `**Total mensajes:** ${resumen.totalMensajes}`,
      ``,
      `**Top 5 usuarios:**`,
      ...top5.map(
        (u, i) =>
          `${i + 1}. **${u.usuario}** — ${u.total} msgs (📝 ${u.totalTexto} texto | 🖼️ ${u.totalMedia} media | 🎤 ${u.totalVoz} voz)`,
      ),
      ``,
      `_El archivo JSON completo está adjunto._`,
    ].join("\n");

    await sendChannel.send({
      content: summaryText,
      files: [attachment],
    });

    if (sendChannel.id !== interaction.channelId) {
      await interaction.editReply(`✅ Resumen enviado a <#${sendChannel.id}>`);
    } else {
      await interaction.editReply("✅ Resumen generado.");
    }
  },
};
