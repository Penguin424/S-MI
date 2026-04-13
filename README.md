# SØMI — Bot de Discord

**SØMI** es un bot de Discord inspirado en **So Mi (Songbird)**, la enigmática netrunner del DLC *Phantom Liberty* de **Cyberpunk 2077**. Así como So Mi operaba desde las sombras con habilidades excepcionales en la red, este bot trabaja silenciosamente en tu servidor de Discord ejecutando tareas útiles a través de slash commands.

## Características

- `/ping` — Comprueba la latencia del bot.
- `/conteo-mensajes` — Realiza un conteo detallado de mensajes en los canales del servidor, clasificándolos por tipo (texto, media, voz) y generando un reporte por usuario.

## Tecnologías

- [Discord.js](https://discord.js.org/) v14
- TypeScript
- Node.js
- dotenv

## Requisitos

- Node.js 18+
- pnpm

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/SOMI.git
cd SOMI

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu token de Discord, client ID y guild ID
```

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
DISCORD_TOKEN=tu_token_aquí
CLIENT_ID=tu_client_id_aquí
GUILD_ID=tu_guild_id_aquí
```

## Uso

```bash
# Compilar TypeScript
pnpm build

# Registrar slash commands
node dist/deploy-commands.js

# Iniciar el bot
pnpm start

# Modo desarrollo (recompila automáticamente)
pnpm dev
```

## Estructura del proyecto

```
src/
├── index.ts              # Punto de entrada del bot
├── deploy-commands.ts    # Registro de slash commands
├── commands/
│   ├── utility/          # Comandos de utilidad
│   │   ├── ping.ts
│   │   └── conteo-mensajes.ts
│   └── services/         # Comandos de servicios
├── events/
│   ├── ready.ts          # Evento de conexión
│   └── interactionCreate.ts
└── interfaces/
    └── customClient.ts
```

## Licencia

MIT
