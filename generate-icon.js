// Pure Node.js 128x128 PNG generator using built-in zlib
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPng(width, height) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  // Draw 128x128 app icon:
  // Dark slate rounded square background with blue sketch border and golden artist pencil
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Distance from center
      const cx = 64;
      const cy = 64;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);

      // Rounded rectangle test (radius 24, bounds 12 to 116)
      const inBox = dx <= 52 && dy <= 52;
      const cornerDx = Math.max(0, dx - 36);
      const cornerDy = Math.max(0, dy - 36);
      const cornerDist = Math.hypot(cornerDx, cornerDy);
      const inRoundedRect = cornerDist <= 16;

      if (!inRoundedRect) {
        // Transparent outside
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
        continue;
      }

      // Border ring (blue stroke #38bdf8)
      const onBorder = cornerDist >= 13 && cornerDist <= 16;
      if (onBorder || ((dx === 51 || dx === 52 || dy === 51 || dy === 52) && cornerDist < 16)) {
        buffer[idx] = 56;     // R
        buffer[idx + 1] = 189; // G
        buffer[idx + 2] = 248; // B
        buffer[idx + 3] = 255; // A
        continue;
      }

      // Pencil diagonal test (from 35, 93 to 93, 35)
      // Line: x + y ≈ 128, perpendicular distance: |x - y|
      const pDiag = Math.abs((x - 30) - (128 - y - 30));
      const inPencilShaft = x >= 40 && x <= 88 && y >= 40 && y <= 88 && Math.abs(x - (128 - y)) <= 9;
      const inPencilTip = x >= 32 && x <= 44 && y >= 84 && y <= 96 && (x + y >= 122 && x + y <= 134);

      if (inPencilTip) {
        // Golden pencil tip #f59e0b
        buffer[idx] = 245;
        buffer[idx + 1] = 158;
        buffer[idx + 2] = 11;
        buffer[idx + 3] = 255;
        continue;
      }

      if (inPencilShaft) {
        // Pencil wood #fbbf24
        buffer[idx] = 251;
        buffer[idx + 1] = 191;
        buffer[idx + 2] = 36;
        buffer[idx + 3] = 255;
        continue;
      }

      // Sparkle green dot at top right (92, 36)
      const sparkDist = Math.hypot(x - 92, y - 36);
      if (sparkDist <= 6) {
        buffer[idx] = 34;
        buffer[idx + 1] = 197;
        buffer[idx + 2] = 94;
        buffer[idx + 3] = 255;
        continue;
      }

      // Graph paper grid lines inside icon
      const onGrid = (x % 16 === 0 || y % 16 === 0);
      if (onGrid) {
        buffer[idx] = 39;
        buffer[idx + 1] = 39;
        buffer[idx + 2] = 48;
        buffer[idx + 3] = 255;
      } else {
        // Background #18181b
        buffer[idx] = 24;
        buffer[idx + 1] = 24;
        buffer[idx + 2] = 27;
        buffer[idx + 3] = 255;
      }
    }
  }

  // PNG filter byte 0 prepended to each scanline
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // Filter None
    buffer.copy(
      scanlines,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const deflated = zlib.deflateSync(scanlines);

  // PNG Signature
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk("IHDR", ihdrData);
  const idatChunk = createChunk("IDAT", deflated);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);

  const crcData = chunk.subarray(4, 8 + len);
  const crcVal = crc32(crcData);
  chunk.writeInt32BE(crcVal, 8 + len);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Generate dist/icon.png and resources/icon.png
const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const pngBuffer = createPng(128, 128);
fs.writeFileSync(path.join(distDir, "icon.png"), pngBuffer);
fs.writeFileSync(path.join(__dirname, "icon.png"), pngBuffer);
console.log("Created 128x128 icon.png successfully!");
