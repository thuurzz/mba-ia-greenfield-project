import { handlers as authHandlers } from "./auth";
import { handlers as seedHandlers } from "./_seed";
import { handlers as videoHandlers } from "./videos";
import { handlers as categoryHandlers } from "./categories";
import { handlers as channelHandlers } from "./channels";
import { handlers as socialHandlers } from "./social";

export const handlers = [
  ...authHandlers,
  ...seedHandlers,
  ...videoHandlers,
  ...categoryHandlers,
  ...channelHandlers,
  ...socialHandlers,
];
