import { effectScope } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useFriendlyExplorer } from '@/composables/useFriendlyExplorer';
import type { LocationReading } from '@/lib/friendly-location';
import { dataAdapter, snapshot } from './friendly-fixtures';
function setup(location = vi.fn(async (): Promise<LocationReading> => ({ source: 'browser', position: null, reason: 'denied', message: '拒絕定位' }))) {
  const scope = effectScope(); const data = dataAdapter();
  const state = scope.run(() => useFriendlyExplorer(location, data))!;
  return { state, scope, data };
}
describe('friendly explorer flow', () => {
  it('loads real data, OR filters, manual points, routes and clears previous route when any input changes', async () => {
    const { state, scope } = setup(); await state.load();
    state.toggleService('wifi'); state.toggleService('charge');
    expect(state.visibleStores.value.every((store) => store.services.includes('wifi') || store.services.includes('charge'))).toBe(true);
    state.selectStart('tpe-0360'); state.selectDestination('tpe-0538');
    // Use known connected points from the real snapshot rather than fabricate GPS.
    if (!state.start.value || !state.destination.value) throw new Error('Snapshot point IDs changed');
    state.compare(); expect(state.comparison.value?.error).toBeUndefined();
    expect(state.comparison.value?.routes.length).toBeGreaterThan(0);
    state.radius.value = 100; expect(state.comparison.value).toBeNull();
    state.compare(); state.toggleService('toilet'); expect(state.comparison.value).toBeNull();
    state.compare(); state.selectDestination(snapshot.stores[2]!.id); expect(state.comparison.value).toBeNull();
    scope.stop();
  });
  it('preserves manual input when an uncancellable location reply arrives late', async () => {
    let deliver!: (reading: LocationReading) => void;
    const get = vi.fn(() => new Promise<LocationReading>((resolve) => { deliver = resolve; }));
    const { state, scope } = setup(get); await state.load();
    const request = state.locate(); state.selectStart(snapshot.stores[0]!.id);
    deliver({ source: 'native', position: { latitude: 25.03, longitude: 121.56, accuracy: 10, timestamp: Date.now() }, message: '已定位' });
    await request;
    expect(state.start.value?.id).toBe(snapshot.stores[0]!.id);
    expect(state.start.value?.source).toBe('manual'); expect(state.reading.value).toBeNull();
    scope.stop();
  });
  it('does not send GPS to data API and never uses rejected coordinates as start', async () => {
    const { state, scope, data } = setup(); await state.load(); await state.locate();
    expect(state.reading.value?.reason).toBe('denied'); expect(state.start.value).toBeNull();
    expect(data.stores).toHaveBeenCalledTimes(1);
    expect(vi.mocked(data.stores).mock.calls[0]).toHaveLength(1);
    expect(vi.mocked(data.stores).mock.calls[0]![0]).toBeInstanceOf(AbortSignal);
    scope.stop();
  });
  it('never accepts a simulated native position as GPS', async () => {
    const simulated = vi.fn(async (): Promise<LocationReading> => ({ source: 'native',
      position: { latitude: 25.03, longitude: 121.56, timestamp: Date.now(), accuracy: 10, is_mocked: true },
      reason: 'simulated', message: '模擬位置，未作為真實起點' }));
    const { state, scope } = setup(simulated); await state.load(); await state.locate();
    expect(state.start.value).toBeNull(); expect(state.reading.value?.reason).toBe('simulated'); scope.stop();
  });
  it('keeps readable directory on graph failure and supports retry', async () => {
    const { state, scope, data } = setup();
    vi.mocked(data.router).mockRejectedValueOnce(new Error('graph unavailable'));
    await state.load(); expect(state.stores.value.length).toBe(103);
    expect(state.graphError.value).toContain('graph unavailable'); expect(state.canCompare.value).toBe(false);
    await state.loadGraph(); expect(state.graphError.value).toBe(''); expect(state.router.value).not.toBeNull();
    scope.stop();
  });
  it('rejects mixed data versions and cancels requests on scope disposal', async () => {
    const { state, scope, data } = setup();
    vi.mocked(data.stores).mockResolvedValueOnce({ version: 'wrong-version', stores: snapshot.stores });
    await state.load(); expect(state.error.value).toContain('版本不一致'); expect(state.stores.value).toEqual([]);
    const signal = vi.mocked(data.stores).mock.calls[0]![0]; scope.stop(); expect(signal.aborted).toBe(true);
  });
});
