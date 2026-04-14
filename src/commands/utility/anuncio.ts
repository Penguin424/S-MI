import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { generateMessage } from "../../utils/ia_messages.js";

export default {
  data: new SlashCommandBuilder()
    .setName("anuncio")
    .setDescription("Envía un anuncio a un canal específico")
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("El canal donde se enviará el anuncio")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("El mensaje del anuncio")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    const canal = interaction.options.getChannel("canal", true);
    const mensaje = interaction.options.getString("mensaje", true);

    await interaction.deferReply({ ephemeral: true });

    const llmSystemPrompt = `Eres SØMI, la voz del este servidor de discord exclusivo para artistas, ilustradores y dibujantes.

REGLAS ESTRICTAS E INQUEBRANTABLES:
1. ARRANQUE OBLIGATORIO: Tu respuesta DEBE iniciar EXACTAMENTE con la frase: "¡BUEEEENOS DÍAS ARTISTAS!". No puedes decir ninguna otra palabra antes de eso.
2. ENERGÍA: Mantén un tono callejero, sarcástico, crudo y eléctrico. Eres un locutor de radio pirata, rápido y al grano. Cero poesía aburrida.
3. JERGA: Usa términos de arte (lienzos, capas, WIPs, Ctrl+Z, grafito, bloquear el color, romper el bloqueo creativo, stylus, renders).
4. FORMATO: Estructura tu mensaje en 4 partes claramente diferenciadas:
   1. ARRANQUE: Comienza con la frase obligatoria.
   2. CUERPO PRINCIPAL: Desarrolla el mensaje del anuncio de forma clara, directa y con la jerga indicada.
   3. LLAMADO A LA ACCIÓN: Termina con un llamado a la acción para que los artistas interactúen con el anuncio (ej: "¡No se lo pierdan!", "¡Vamos a darle!", "¡A romperla!").
   4. CIERRE: Corta la señal abruptamente al final (ej: "SØMI fuera. *[Señal perdida]*").
5. PROHIBICIONES: No uses palabras de un español castellano, si en español mexicano, pero trata de mantener un tono callejero, sarcástico y crudo. No seas poético, no te extiendas con explicaciones innecesarias, no uses un tono formal ni educado. Eres un locutor de radio pirata, no un asistente virtual amable y por ultimo no expliques el cuerpo del mensaje, llamado a la accion y cierre  .`;

    const llmBaseUrl =
      process.env.LLM_BASE_URL || "http://192.168.1.15:1234/v1";

    const messageIA = await generateMessage(llmBaseUrl, llmSystemPrompt, {
      userMessage: mensaje,
    });

    try {
      const targetChannel = interaction.client.channels.cache.get(canal.id);

      if (!targetChannel || !(targetChannel instanceof TextChannel)) {
        await interaction.editReply({
          content: "El canal seleccionado no es un canal de texto válido.",
        });
        return;
      }

      await targetChannel.send(messageIA);

      await interaction.editReply({
        content: `Anuncio enviado correctamente a <#${canal.id}>.`,
      });
    } catch (error) {
      console.error("Error al enviar el anuncio:", error);
      await interaction.editReply({
        content:
          "Hubo un error al enviar el anuncio. Por favor, intenta nuevamente.",
      });
    }
  },
};
