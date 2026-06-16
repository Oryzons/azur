import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const STORAGE_PREFIX = 'bleu-calanque:page-filters:';

function storageKey(pageKey: string): string {
  return `${STORAGE_PREFIX}${pageKey}`;
}

export function readPageFilters<T>(pageKey: string, deserialize: (raw: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(storageKey(pageKey));
    if (!raw) return null;
    return deserialize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePageFilters(pageKey: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey(pageKey), JSON.stringify(value));
  } catch {
    /* quota / mode privé */
  }
}

export function clearPageFilters(pageKey: string): void {
  try {
    localStorage.removeItem(storageKey(pageKey));
  } catch {
    /* ignore */
  }
}

/** État de filtre synchronisé avec localStorage (restauré au rechargement). */
export function usePersistedPageFilters<T>(
  pageKey: string,
  defaultValue: T,
  serialize: (value: T) => unknown,
  deserialize: (raw: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readPageFilters(pageKey, deserialize) ?? defaultValue);

  useEffect(() => {
    writePageFilters(pageKey, serialize(state));
  }, [pageKey, state]);

  return [state, setState];
}

function readString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function readBoolean(raw: unknown): boolean | null {
  return typeof raw === 'boolean' ? raw : null;
}

function readNullableString(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  return typeof raw === 'string' ? raw : null;
}

function readEnum<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === 'string' && allowed.includes(raw as T) ? (raw as T) : null;
}

export function usePersistedString(
  pageKey: string,
  defaultValue = '',
): [string, Dispatch<SetStateAction<string>>] {
  return usePersistedPageFilters(pageKey, defaultValue, (v) => v, readString);
}

export function usePersistedBoolean(
  pageKey: string,
  defaultValue: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  return usePersistedPageFilters(pageKey, defaultValue, (v) => v, readBoolean);
}

export function usePersistedNullableString(
  pageKey: string,
  defaultValue: string | null,
): [string | null, Dispatch<SetStateAction<string | null>>] {
  return usePersistedPageFilters(
    pageKey,
    defaultValue,
    (v) => v,
    (raw) => readNullableString(raw) ?? null,
  );
}

export function usePersistedEnum<T extends string>(
  pageKey: string,
  defaultValue: T,
  allowed: readonly T[],
): [T, Dispatch<SetStateAction<T>>] {
  return usePersistedPageFilters(pageKey, defaultValue, (v) => v, (raw) => readEnum(raw, allowed));
}
