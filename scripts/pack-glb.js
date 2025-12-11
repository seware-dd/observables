#!/usr/bin/env node
/**
 * Minimal glTF (.gltf + external .bin) to GLB packer.
 * Supports models that use a single external binary buffer; images may already be data URIs.
 * Usage: node scripts/pack-glb.js input.gltf output.glb
 */
const fs = require("fs");
const path = require("path");

function padTo4(buf, padByte = 0x20) {
  const padding = (4 - (buf.length % 4)) % 4;
  if (padding === 0) return buf;
  const pad = Buffer.alloc(padding, padByte);
  return Buffer.concat([buf, pad]);
}

function toLittleEndianUInt32(val) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(val, 0);
  return b;
}

function packGlb(inputPath, outputPath) {
  const gltfDir = path.dirname(inputPath);
  const gltfJson = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(gltfJson.buffers) || gltfJson.buffers.length === 0) {
    throw new Error("No buffers found in glTF.");
  }

  const buffer0 = gltfJson.buffers[0];
  if (!buffer0.uri) {
    throw new Error("Expected an external .bin uri on the first buffer.");
  }
  const binPath = path.resolve(gltfDir, buffer0.uri);
  const binData = fs.readFileSync(binPath);

  // Remove external uri and set byteLength
  buffer0.uri = undefined;
  buffer0.byteLength = binData.length;

  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuf = padTo4(Buffer.from(jsonStr, "utf8"), 0x20); // pad JSON with spaces
  const binBuf = padTo4(binData, 0x00); // pad BIN with zeros

  // GLB header
  const magic = Buffer.from("glTF");
  const version = toLittleEndianUInt32(2);
  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const length = toLittleEndianUInt32(totalLength);

  // Chunks
  const jsonLength = toLittleEndianUInt32(jsonBuf.length);
  const jsonType = Buffer.from("JSON");
  const binLength = toLittleEndianUInt32(binBuf.length);
  const binType = Buffer.from("BIN\0");

  const glb = Buffer.concat([
    magic, version, length,
    jsonLength, jsonType, jsonBuf,
    binLength, binType, binBuf
  ]);

  fs.writeFileSync(outputPath, glb);
  console.log(`Packed ${path.basename(inputPath)} -> ${outputPath} (${glb.length} bytes)`);
}

if (require.main === module) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Usage: node scripts/pack-glb.js input.gltf output.glb");
    process.exit(1);
  }
  packGlb(inputPath, outputPath);
}
