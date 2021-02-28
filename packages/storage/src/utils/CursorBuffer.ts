/**
 * A wrapper around byte buffers to perform cursor reading on bytes
 * of different sizes
 *
 */
export class CursorBuffer {
  private readonly dataView: DataView;

  private readonly littleEndian: boolean;

  private bytePositon: number;

  constructor(typedArray: Uint8Array, littleEndian = true) {
    this.dataView = new DataView(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength,
    );
    this.littleEndian = littleEndian;
    this.bytePositon = 0;
  }

  /**
   * Reads 1 byte
   *
   */
  public read8(): number {
    const value = this.dataView.getUint8(this.bytePositon);
    this.bytePositon += 1;
    return value;
  }

  /**
   * Reads 4 bytes
   *
   */
  public read32(): number {
    const value = this.dataView.getUint32(this.bytePositon, this.littleEndian);
    this.bytePositon += 4;
    return value;
  }

  /**
   * Skip/move the internal reader pointers x bytes
   *
   * A negative value can be passed to skip backwards
   */
  public skipXBytes(x: number): void {
    if (this.bytePositon + x < 0) {
      this.bytePositon = 0;
    } else {
      this.bytePositon += x;
    }
  }

  public readXBytes(x: number): Uint8Array {
    const startPosition = this.bytePositon + this.dataView.byteOffset;
    const value = new Uint8Array(this.dataView.buffer, startPosition, x);
    this.bytePositon += x;

    return value;
  }

  // note this does not move the internal pointer
  public readRemainingBytes(): Uint8Array {
    const startPosition = this.bytePositon + this.dataView.byteOffset;
    const value = new Uint8Array(this.dataView.buffer, startPosition);
    return value;
  }

  public get bytesLeft(): number {
    const currentPosition = this.bytePositon + this.dataView.byteOffset;
    return Math.max(this.dataView.byteLength - currentPosition - 1, 0);
  }
}

export default CursorBuffer;
