import { StorageService } from '@floorball/core';
import { ShotInput } from '@floorball/types';

import { ShotBuffer } from './shot-buffer';

class MemoryStorage {
  public data = new Map<string, string>();
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  getItem(key: string) {
    return this.data.get(key) ?? '';
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function input(uuid: string, overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    client_uuid: uuid,
    team: 'home',
    period: 1,
    game_time: '',
    tapped_at: '2026-10-16T12:00:00.000Z',
    x: 0.5,
    y: 0.5,
    result: 'saved',
    ...overrides,
  };
}

describe('ShotBuffer', () => {
  let storage: MemoryStorage;
  let buffer: ShotBuffer;

  beforeEach(() => {
    storage = new MemoryStorage();
    buffer = new ShotBuffer(storage as unknown as StorageService, 4711);
  });

  it('übersteht ein Neuladen der Seite', () => {
    buffer.upsert(input('a'));

    const reloaded = new ShotBuffer(storage as unknown as StorageService, 4711);
    expect(reloaded.upserts.map((shot) => shot.client_uuid)).toEqual(['a']);
  });

  it('trennt die Puffer verschiedener Spiele', () => {
    buffer.upsert(input('a'));

    const other = new ShotBuffer(storage as unknown as StorageService, 4712);
    expect(other.size).toBe(0);
  });

  it('ersetzt eine ältere Fassung desselben Schusses', () => {
    buffer.upsert(input('a'));
    buffer.upsert(input('a', { result: 'goal' }));

    expect(buffer.upserts.length).toBe(1);
    expect(buffer.upserts[0].result).toBe('goal');
  });

  it('bestätigt nur unveränderte Schüsse', () => {
    buffer.upsert(input('a'));
    buffer.upsert(input('b'));
    const sent = buffer.upserts;

    // Korrektur während der Übertragung.
    buffer.upsert(input('b', { result: 'goal' }));
    buffer.acknowledgeUpserts(sent);

    expect(buffer.upserts.map((shot) => shot.client_uuid)).toEqual(['b']);
    expect(buffer.upserts[0].result).toBe('goal');
  });

  it('löscht nur beim Server, was der Server kennt', () => {
    buffer.upsert(input('a'));
    buffer.upsert(input('b'));

    buffer.remove('a', false);
    buffer.remove('b', true);

    expect(buffer.upserts).toEqual([]);
    expect(buffer.deletes).toEqual(['b']);

    buffer.acknowledgeDelete('b');
    expect(buffer.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it('verträgt kaputten Speicherinhalt', () => {
    storage.setItem('tablet_shot_buffer_1', '{kaputt');
    expect(new ShotBuffer(storage as unknown as StorageService, 1).size).toBe(
      0
    );
  });
});
