import { describe, it, expect } from 'vitest';
import { formatBytes, parseBytes } from '../src/utils/bytes.js';
import { normalizePath, getRelativePath } from '../src/utils/paths.js';
import { hashBuffer } from '../src/utils/hashing.js';

describe('utils', () => {
  describe('bytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(18.4 * 1024 * 1024)).toBe('18.4 MB');
    });

    it('parses byte strings correctly', () => {
      expect(parseBytes(500)).toBe(500);
      expect(parseBytes('500B')).toBe(500);
      expect(parseBytes('500kb')).toBe(500 * 1024);
      expect(parseBytes('10MB')).toBe(10 * 1024 * 1024);
      expect(parseBytes('1.5 gb')).toBe(Math.round(1.5 * 1024 * 1024 * 1024));
    });

    it('throws on invalid byte strings', () => {
      expect(() => parseBytes('invalid')).toThrow();
      expect(() => parseBytes('500xyz')).toThrow();
    });
  });

  describe('paths', () => {
    it('normalizes backslashes to forward slashes', () => {
      expect(normalizePath('public\\images\\hero.png')).toBe('public/images/hero.png');
    });

    it('computes normalized relative paths', () => {
      expect(getRelativePath('/root/project', '/root/project/src/img.png')).toBe('src/img.png');
    });
  });

  describe('hashing', () => {
    it('computes sha256 buffer hash', () => {
      const buffer = Buffer.from('hello imgclean');
      const hash = hashBuffer(buffer);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // sha256 hex string length
    });
  });
});
