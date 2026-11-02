import crc32 from 'crc-32';

const HEADER_SIZE = 64;
const ENTRY_SIZE = 32;
const ALIGNMENT = 64;

const getPaddingBuffer = (currentSize: number): Uint8Array => {
  const remainder = currentSize % ALIGNMENT;
  const paddingSize = remainder === 0 ? 0 : ALIGNMENT - remainder;
  return new Uint8Array(paddingSize);
};

export interface WbnkCompileData {
  instrumente: any[];
  zone: any[];
  textMeta: any;
  textSynt: any;
  rawAudioBytes?: Uint8Array;
}

export async function compileWbnkToDisk(
  fileHandle: any, 
  data: WbnkCompileData, 
  onStatusUpdate: (msg: string) => void
): Promise<number> {
  const writable = await fileHandle.createWritable();
  onStatusUpdate('Structuring binary payloads...');

  const metaBytes = new TextEncoder().encode(JSON.stringify(data.textMeta || {}));
  const syntBytes = new TextEncoder().encode(JSON.stringify(data.textSynt || {}));

  const smplBytes = new Uint8Array(4 + 32); 
  const smplView = new DataView(smplBytes.buffer);
  smplView.setUint32(0, 0, true); 

  const instHeader = new Uint8Array(8);
  const instView = new DataView(instHeader.buffer);
  instView.setUint32(0, data.instrumente?.length || 0, true); 
  instView.setUint32(4, data.zone?.length || 0, true); 
  const instBytes = instHeader; 

  const dataBytes = data.rawAudioBytes || new Uint8Array(1024 * 10); 

  const chunksToProcess = [
    { id: 'META', body: metaBytes },
    { id: 'SMPL', body: smplBytes },
    { id: 'INST', body: instBytes },
    { id: 'DATA', body: dataBytes },
    { id: 'SYNT', body: syntBytes }
  ];

  await writable.write({ type: 'write', position: 0, data: new Uint8Array(HEADER_SIZE) });

  let currentOffset = HEADER_SIZE;
  const chunkTableEntries: Uint8Array[] = [];

  for (const chunk of chunksToProcess) {
    onStatusUpdate(`Writing aligned chunk block: ${chunk.id}...`);

    const bodyLen = chunk.body.length;
    const checksum = crc32.buf(Buffer.from(chunk.body.buffer)) >>> 0;

    await writable.write({ type: 'write', position: currentOffset, data: chunk.body });
    currentOffset += bodyLen;

    const padding = getPaddingBuffer(bodyLen);
    if (padding.length > 0) {
      await writable.write({ type: 'write', position: currentOffset, data: padding });
      currentOffset += padding.length;
    }

    const entryBuffer = new ArrayBuffer(ENTRY_SIZE);
    const entryView = new DataView(entryBuffer);
    
    for (let j = 0; j < Math.min(chunk.id.length, 4); j++) {
      entryView.setUint8(j, chunk.id.charCodeAt(j));
    }
    
    entryView.setBigUint64(8, BigInt(currentOffset - bodyLen - padding.length), true);
    entryView.setBigUint64(16, BigInt(bodyLen), true);
    entryView.setUint32(24, checksum, true); 

    chunkTableEntries.push(new Uint8Array(entryBuffer));
  }

  const chunkTableOffset = currentOffset;
  onStatusUpdate('Assembling Chunk Table index keys...');
  
  for (const entry of chunkTableEntries) {
    await writable.write({ type: 'write', position: currentOffset, data: entry });
    currentOffset += ENTRY_SIZE;
  }

  const totalFileSize = currentOffset;

  const dataChecksum = crc32.buf(Buffer.from(dataBytes.buffer)) >>> 0;
  const antiTamper = new Uint8Array(16);
  const antiTamperView = new DataView(antiTamper.buffer);
  antiTamperView.setUint32(0, dataChecksum ^ 0xDEADBEEF, true);

  onStatusUpdate('Finalizing global system header checksum...');
  const headerBuffer = new ArrayBuffer(HEADER_SIZE);
  const headerView = new DataView(headerBuffer);

  headerView.setUint8(0, 'W'.charCodeAt(0));
  headerView.setUint8(1, 'B'.charCodeAt(0));
  headerView.setUint8(2, 'N'.charCodeAt(0));
  headerView.setUint8(3, 'K'.charCodeAt(0));
  headerView.setUint16(4, 1, true); 
  headerView.setUint16(6, 0, true); 
  headerView.setUint32(12, chunksToProcess.length, true);
  headerView.setBigUint64(16, BigInt(chunkTableOffset), true);
  headerView.setBigUint64(24, BigInt(totalFileSize), true);

  const headerUint8 = new Uint8Array(headerBuffer);
  headerUint8.set(antiTamper, 32);

  const headerChecksum = crc32.buf(Buffer.from(headerUint8.subarray(0, 48))) >>> 0;
  headerView.setUint32(60, headerChecksum, true);

  await writable.write({ type: 'write', position: 0, data: headerUint8 });
  await writable.close();
  
  return totalFileSize;
}
