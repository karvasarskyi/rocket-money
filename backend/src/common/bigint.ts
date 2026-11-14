// BigInt (telegramId) is not JSON-serializable by default. Serialize it as a string.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export {};
