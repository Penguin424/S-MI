import type { Client, Collection } from "discord.js";

export interface ICustomClient extends Client {
  commands: Collection<string, any>;
}
