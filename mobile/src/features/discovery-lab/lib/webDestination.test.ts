import { describe, expect, it } from 'vitest';
import { discoveryWebDestination } from './webDestination';
describe('Discovery web destinations', () => {
  it('uses only the paired documented SPA deployment and encodes the exploration id', () => {
    expect(discoveryWebDestination('https://family.example/chore-api', 'space page')).toBe('https://family.example/chore/discovery-lab/space%20page');
    expect(discoveryWebDestination('https://family.example/prefix/chore-api/', 'orbit')).toBe('https://family.example/prefix/chore/discovery-lab/orbit');
  });
  it('does not invent a web origin or carry credentials from an unknown API route', () => {
    for (const url of ['https://api.example/v1', 'file:///chore-api', 'https://user:secret@family.example/chore-api', 'invalid']) expect(discoveryWebDestination(url, 'orbit')).toBeNull();
  });
});
