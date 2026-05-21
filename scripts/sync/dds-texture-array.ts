import decodeDxt from "decode-dxt";
import { decodeBC7 } from "@bis-toolkit/bcn";

export type DdsFormat = "bc1" | "bc7";

export interface DdsTextureArray {
  width: number;
  height: number;
  arraySize: number;
  format: DdsFormat;
  headerSize: number;
  /** Bytes per array slice including full mip chain (DX10 array layout). */
  sliceStride: number;
}

/** BC compressed size for one mip level. */
function mipLevelBytes(width: number, height: number, format: DdsFormat): number {
  const blocksW = Math.max(1, Math.ceil(width / 4));
  const blocksH = Math.max(1, Math.ceil(height / 4));
  const bytesPerBlock = format === "bc1" ? 8 : 16;
  return blocksW * blocksH * bytesPerBlock;
}

/** Total storage for one array slice (mip 0 through 1×1). */
export function sliceStrideFor(width: number, height: number, format: DdsFormat): number {
  let total = 0;
  let w = width;
  let h = height;
  while (w >= 1 && h >= 1) {
    total += mipLevelBytes(w, h, format);
    if (w === 1 && h === 1) break;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return total;
}

export function parseDdsTextureArray(buf: Buffer): DdsTextureArray {
  const magic = buf.toString("ascii", 0, 4);
  if (magic !== "DDS ") throw new Error("Invalid DDS magic");

  const height = buf.readUInt32LE(12);
  const width = buf.readUInt32LE(16);
  const fourCC = buf.toString("ascii", 84, 88);
  if (fourCC !== "DX10") throw new Error(`Unsupported DDS fourCC: ${fourCC}`);

  const dxgi = buf.readUInt32LE(128);
  const arraySize = buf.readUInt32LE(140);
  const headerSize = 148;

  // DXGI_FORMAT_BC1_UNORM = 71, BC7_UNORM = 98
  let format: DdsFormat;
  if (dxgi === 71) format = "bc1";
  else if (dxgi === 98) format = "bc7";
  else throw new Error(`Unsupported DXGI format ${dxgi}`);

  const sliceStride = sliceStrideFor(width, height, format);
  const expected = headerSize + arraySize * sliceStride;
  if (buf.length !== expected) {
    throw new Error(
      `DDS size mismatch: file ${buf.length} bytes, expected ${expected} ` +
        `(header ${headerSize} + ${arraySize} slices × ${sliceStride})`,
    );
  }

  return { width, height, arraySize, format, headerSize, sliceStride };
}

export function decodeDdsSlice(
  buf: Buffer,
  meta: DdsTextureArray,
  /** 1-based index from PoB ddsCoords (matches DrawImage stackIdx). */
  index: number,
): Uint8Array {
  if (index < 1 || index > meta.arraySize) {
    throw new Error(`Slice index ${index} out of range 1..${meta.arraySize}`);
  }
  const sliceIdx = index - 1;
  const offset = meta.headerSize + sliceIdx * meta.sliceStride;
  const mip0Bytes = mipLevelBytes(meta.width, meta.height, meta.format);
  const slice = buf.subarray(offset, offset + mip0Bytes);

  if (meta.format === "bc1") {
    const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
    return decodeDxt(dv, meta.width, meta.height, "dxt1");
  }

  const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
  return decodeBC7(dv, meta.width, meta.height);
}
