import { describe, expect, it } from 'vitest';

import { VERSION_MOTOR } from '../index.js';
import { versionesCompatibles } from './protocolo.js';

describe('versiones del protocolo', () => {
  it('un parche no rompe el protocolo', () => {
    expect(versionesCompatibles('0.7.0', '0.7.3')).toBe(true);
  });

  it('cambiar la minor si lo rompe', () => {
    expect(versionesCompatibles('0.7.0', '0.8.0')).toBe(false);
    expect(versionesCompatibles('1.7.0', '0.7.0')).toBe(false);
  });

  it('el protocolo va con la version del motor', () => {
    expect(versionesCompatibles(VERSION_MOTOR, VERSION_MOTOR)).toBe(true);
  });
});
