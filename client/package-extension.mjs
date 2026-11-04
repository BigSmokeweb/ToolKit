import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Small deterministic ZIP writer (stored entries) keeps packaging portable without another dependency.
const files = [
  "manifest.json",
  "background.js",
  "capture.mjs",
  "options.html",
  "options.js",
  "result.html",
  "result.js",
  "style.css",
];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const entries = [],
  central = [];
let offset = 0;
for (const path of files) {
  const data = readFileSync(resolve(import.meta.dirname, "../extension", path)),
    name = Buffer.from(path),
    crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x800, 8);
  directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc, 16);
  directory.writeUInt32LE(data.length, 20);
  directory.writeUInt32LE(data.length, 24);
  directory.writeUInt16LE(name.length, 28);
  directory.writeUInt32LE(offset, 42);
  entries.push(local, name, data);
  central.push(directory, name);
  offset += local.length + name.length + data.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const output = resolve(import.meta.dirname, "public/downloads");
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, "lead-desk-capture.zip"),
  Buffer.concat([...entries, directory, end]),
);
console.log(`Packaged browser capture extension (${files.length} files).`);
