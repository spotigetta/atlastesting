import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const svg = await fs.readFile(path.join(root, "assets/icons/atlas-icon.svg"));
const output = path.join(root, "assets/icons");

await Promise.all([
  sharp(svg).resize(192, 192).png().toFile(path.join(output, "icon-192.png")),
  sharp(svg).resize(512, 512).png().toFile(path.join(output, "icon-512.png")),
  sharp(svg).resize(512, 512).png().toFile(path.join(output, "icon-maskable-512.png")),
  sharp(svg).resize(180, 180).png().toFile(path.join(output, "apple-touch-icon.png"))
]);

console.log("Iconos Atlas generados: Android, maskable e iPhone.");
