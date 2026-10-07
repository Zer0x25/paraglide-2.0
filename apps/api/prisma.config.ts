import dotenv from "dotenv";
import path from "path";
import { defineConfig } from "prisma/config";

for (const p of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
]) {
  dotenv.config({ path: p });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

