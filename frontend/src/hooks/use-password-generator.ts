"use client";

import { useCallback, useMemo, useState } from "react";

export type PasswordGeneratorOptions = {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
};

const defaultOptions: PasswordGeneratorOptions = {
  length: 16,
  includeLowercase: true,
  includeUppercase: true,
  includeDigits: true,
  includeSymbols: false,
};

const CHARSETS = {
  includeLowercase: "abcdefghijklmnopqrstuvwxyz",
  includeUppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  includeDigits: "0123456789",
  includeSymbols: "!@#$%^&*()-_=+[]{}<>?.,",
} as const;

function buildCharset(options: PasswordGeneratorOptions): string {
  return (Object.keys(CHARSETS) as Array<keyof typeof CHARSETS>)
    .filter((key) => options[key])
    .map((key) => CHARSETS[key])
    .join("");
}

function pickRandomChar(pool: string): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  const idx = bytes[0] % pool.length;
  return pool[idx];
}

export function usePasswordGenerator() {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(defaultOptions);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);
    const pool = buildCharset(options);
    if (!pool) {
      setError("Select at least one character set.");
      setGeneratedPassword("");
      return;
    }
    const length = Math.min(Math.max(options.length, 8), 64);
    const passwordChars: string[] = [];
    for (let i = 0; i < length; i += 1) {
      passwordChars.push(pickRandomChar(pool));
    }
    setGeneratedPassword(passwordChars.join(""));
  }, [options]);

  const value = useMemo(
    () => ({
      options,
      setOptions,
      generatedPassword,
      generate,
      error,
    }),
    [options, generatedPassword, generate, error],
  );

  return value;
}
