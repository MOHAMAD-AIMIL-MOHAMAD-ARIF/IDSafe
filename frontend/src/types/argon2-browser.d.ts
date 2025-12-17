// frontend/src/types/argon2-browser.d.ts
declare module "argon2-browser" {
  export enum ArgonType {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
  }

  export type HashOptions = {
    pass: Uint8Array;
    salt: Uint8Array;
    time: number;
    mem: number; // KiB
    parallelism: number;
    hashLen: number;
    type: ArgonType;
  };

  export type HashResult = {
    hash: Uint8Array;
    hashHex?: string;
    encoded?: string;
  };

  export function hash(opts: HashOptions): Promise<HashResult>;
}
