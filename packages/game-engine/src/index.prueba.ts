import { describe, expect, it } from 'vitest';

import { VERSION_MOTOR, saludar } from './index.js';

describe('motor de juego', () => {
  it('expone la version del motor', () => {
    expect(VERSION_MOTOR).toBe('0.0.0');
  });

  it('saluda indicando que el motor esta listo', () => {
    expect(saludar()).toBe('MineHunt: motor de juego 0.0.0 listo');
  });
});
