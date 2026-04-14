import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";
import { httpClient } from "../../utils/http_utils.js";

interface UnsplashPhoto {
  urls: {
    regular: string;
    small: string;
  };
  user: {
    name: string;
  };
  description: string | null;
  alt_description: string | null;
}

function createButtons(isPaused: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ref_pause")
      .setLabel(isPaused ? "▶ Reanudar" : "⏸ Pausa")
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ref_skip")
      .setLabel("⏭ Siguiente")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ref_stop")
      .setLabel("⏹ Terminar")
      .setStyle(ButtonStyle.Danger),
  );
}

function createEmbed(
  photo: UnsplashPhoto,
  index: number,
  total: number,
  secondsLeft: number,
  tipoReferencia: string,
  isPaused: boolean,
) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr =
    mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;

  let description =
    `📂 **Categoría:** ${tipoReferencia}\n` +
    `⏱ **Tiempo restante:** ${timeStr}\n` +
    `📸 **Foto por:** ${photo.user.name}\n` +
    `🖼 **Restantes:** ${total - index - 1} referencias`;

  if (isPaused) {
    description += `\n\n⏸ **PAUSADO**`;
  }

  return new EmbedBuilder()
    .setTitle(`📖 Referencia ${index + 1} de ${total}`)
    .setDescription(description)
    .setImage(photo.urls.regular)
    .setColor(isPaused ? 0xffa500 : 0x00ae86)
    .setFooter({
      text: photo.alt_description || photo.description || "Referencia temporal",
    });
}

export default {
  data: new SlashCommandBuilder()
    .setName("referencias-tiempo")
    .setDescription("Inicia actividad de referencias temporales")
    .addIntegerOption((option) =>
      option
        .setName("tiempo")
        .setDescription(
          "Tiempo en minutos antes de pasar a la siguiente referencia",
        )
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("cantidad")
        .setDescription("Cantidad de referencias a mostrar")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("tipo_referencia")
        .setDescription(
          "Tipo de referencia a mostrar (ej: 'anatomia', 'rostro')",
        )
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const tiempo = interaction.options.getInteger("tiempo", true);
    const cantidad = interaction.options.getInteger("cantidad", true);
    const tipoReferencia = interaction.options.getString(
      "tipo_referencia",
      true,
    );

    await interaction.deferReply();

    const response = await httpClient.get(
      `https://api.unsplash.com/search/photos?page=1&per_page=${cantidad}&query=${encodeURIComponent(tipoReferencia)}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`,
    );

    const photos: UnsplashPhoto[] = response.data.results;

    if (!photos || photos.length === 0) {
      await interaction.editReply(
        "No se encontraron referencias para esa búsqueda.",
      );
      return;
    }

    let currentIndex = 0;
    let isPaused = false;
    let shouldStop = false;
    let timeRemaining = tiempo * 60;

    const embed = createEmbed(
      photos[currentIndex]!,
      currentIndex,
      photos.length,
      timeRemaining,
      tipoReferencia,
      false,
    );
    const message = await interaction.editReply({
      embeds: [embed],
      components: [createButtons(false)],
    });

    const advanceToNext = async (): Promise<boolean> => {
      currentIndex++;
      if (currentIndex >= photos.length || shouldStop) {
        const endEmbed = new EmbedBuilder()
          .setTitle("✅ Actividad finalizada")
          .setDescription(
            `Se mostraron ${Math.min(currentIndex, photos.length)} de ${photos.length} referencias de **${tipoReferencia}**.`,
          )
          .setColor(0x00ae86);
        await interaction.editReply({ embeds: [endEmbed], components: [] });
        return false;
      }
      timeRemaining = tiempo * 60;
      const newEmbed = createEmbed(
        photos[currentIndex]!,
        currentIndex,
        photos.length,
        timeRemaining,
        tipoReferencia,
        false,
      );
      await interaction.editReply({
        embeds: [newEmbed],
        components: [createButtons(false)],
      });
      isPaused = false;
      return true;
    };

    const updateEmbed = async () => {
      try {
        const updatedEmbed = createEmbed(
          photos[currentIndex]!,
          currentIndex,
          photos.length,
          timeRemaining,
          tipoReferencia,
          isPaused,
        );
        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [createButtons(isPaused)],
        });
      } catch {
        // message may have been deleted
      }
    };

    const timer = setInterval(async () => {
      if (isPaused || shouldStop) return;

      timeRemaining--;

      const shouldUpdate =
        timeRemaining % 30 === 0 || (timeRemaining <= 10 && timeRemaining > 0);

      if (shouldUpdate) {
        await updateEmbed();
      }

      if (timeRemaining <= 0) {
        const hasMore = await advanceToNext();
        if (!hasMore) {
          clearInterval(timer);
          collector.stop();
        }
      }
    }, 1000);

    const totalTime = tiempo * 60 * 1000 * photos.length + 60_000;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: totalTime,
    });

    collector.on("collect", async (btn) => {
      if (btn.customId === "ref_pause") {
        isPaused = !isPaused;
        await btn.update({
          embeds: [
            createEmbed(
              photos[currentIndex]!,
              currentIndex,
              photos.length,
              timeRemaining,
              tipoReferencia,
              isPaused,
            ),
          ],
          components: [createButtons(isPaused)],
        });
      } else if (btn.customId === "ref_skip") {
        await btn.deferUpdate();
        const hasMore = await advanceToNext();
        if (!hasMore) {
          clearInterval(timer);
          collector.stop();
        }
      } else if (btn.customId === "ref_stop") {
        shouldStop = true;
        clearInterval(timer);
        const endEmbed = new EmbedBuilder()
          .setTitle("⏹ Actividad terminada")
          .setDescription(
            `Se mostraron ${currentIndex + 1} de ${photos.length} referencias de **${tipoReferencia}**.`,
          )
          .setColor(0xff0000);
        await btn.update({ embeds: [endEmbed], components: [] });
        collector.stop();
      }
    });

    collector.on("end", () => {
      clearInterval(timer);
    });
  },
};
