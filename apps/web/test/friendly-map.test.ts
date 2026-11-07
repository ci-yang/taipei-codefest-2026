import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FriendlyMapPage from '@/pages/FriendlyMapPage.vue';
import { friendlyData } from '@/lib/friendly-data';
import { createFriendlyMap } from '@/lib/friendly-map';
import { loadLocalMap, mapCollections } from '@/lib/friendly-map-data';
import { createRouter } from '@app/shared/routing';
import { config, graph, manifest, snapshot } from './friendly-fixtures';
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('@/lib/friendly-map', () => ({ createFriendlyMap: vi.fn() }));
vi.mock('@/lib/friendly-map-data', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/friendly-map-data')>(), loadLocalMap: vi.fn() }));
vi.mock('@/lib/friendly-data', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/friendly-data')>(),
  friendlyData: { stores: vi.fn(), config: vi.fn(), source: vi.fn(), router: vi.fn() } }));
const emptyMap = { type: 'FeatureCollection' as const, features: [] };
const mapHandle = { update: vi.fn(), destroy: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(friendlyData.stores).mockResolvedValue(snapshot);
  vi.mocked(friendlyData.config).mockResolvedValue(config);
  vi.mocked(friendlyData.source).mockResolvedValue(manifest);
  vi.mocked(friendlyData.router).mockResolvedValue(createRouter(graph));
  vi.mocked(loadLocalMap).mockResolvedValue(emptyMap);
  vi.mocked(createFriendlyMap).mockImplementation((_container, _data, _bounds, _error, ready) => { ready(); return mapHandle; });
});
afterEach(() => vi.restoreAllMocks());
async function ready(): Promise<void> { await flushPromises(); await vi.dynamicImportSettled(); await flushPromises(); }
describe('friendly mobile integration degradation', () => {
  it('keeps real named stores and manual route controls after WebGL failure; retry creates a working map', async () => {
    vi.mocked(createFriendlyMap).mockImplementationOnce(() => { throw new Error('WebGL2 unavailable'); });
    const page = mount(FriendlyMapPage); await ready();
    expect(page.text()).toContain('地圖無法顯示');
    expect(page.text()).toContain(snapshot.stores[0]!.name);
    await page.get('#friendly-start').setValue('tpe-0360');
    await page.get('#friendly-destination').setValue('tpe-0538');
    await page.get('button.primary').trigger('click');
    expect(page.findAll('.candidate').length).toBeGreaterThan(0);
    await page.findAll('button').find((button) => button.text() === '重試地圖')!.trigger('click');
    await ready(); expect(page.text()).not.toContain('地圖無法顯示');
    expect(mapHandle.update).toHaveBeenCalled(); page.unmount(); expect(mapHandle.destroy).toHaveBeenCalled();
  });
  it('keeps list after map asset failure and clears selected route from adapter when inputs change', async () => {
    vi.mocked(loadLocalMap).mockRejectedValueOnce(new Error('asset unavailable'));
    const page = mount(FriendlyMapPage); await ready();
    expect(page.text()).toContain('地圖無法顯示'); expect(page.findAll('.store-list li')).toHaveLength(103);
    await page.findAll('button').find((button) => button.text() === '重試地圖')!.trigger('click'); await ready();
    await page.get('#friendly-start').setValue('tpe-0360'); await page.get('#friendly-destination').setValue('tpe-0538');
    await page.get('button.primary').trigger('click');
    expect(mapHandle.update.mock.lastCall?.[0].route).not.toBeNull();
    await page.get('#friendly-radius').setValue('100');
    expect(page.findAll('.candidate')).toHaveLength(0);
    expect(mapHandle.update.mock.lastCall?.[0].route).toBeNull(); page.unmount();
  });
  it('keeps list and retry after graph failure without enabling route calculation', async () => {
    vi.mocked(friendlyData.router).mockRejectedValueOnce(new Error('invalid graph'));
    const page = mount(FriendlyMapPage); await ready();
    expect(page.text()).toContain('路網無法使用'); expect(page.findAll('.store-list li')).toHaveLength(103);
    await page.get('#friendly-start').setValue('tpe-0360'); await page.get('#friendly-destination').setValue('tpe-0538');
    expect(page.get('button.primary').attributes('disabled')).toBeDefined();
    await page.findAll('button').find((button) => button.text() === '重試路網')!.trigger('click'); await ready();
    expect(page.get('button.primary').attributes('disabled')).toBeUndefined(); page.unmount();
  });
  it('converts graph latitude-first coordinates and marks connector segments separately', () => {
    const data = mapCollections({ stores: [snapshot.stores[0]!], points: [{ lat: 25, lng: 121 }], route: {
      id: 'test', label: 'test', coordinates: [[25, 121], [25.01, 121.01], [25.02, 121.02]],
      connectors: [[[25, 121], [25.01, 121.01]]], distanceM: 100, connectorDistanceM: 5, resourceCount: 0,
      storeIds: [], estimateMinutes: 1, viaLabel: '', basis: 'test',
    } });
    expect(data.points.features[0]!.geometry.coordinates).toEqual([121, 25]);
    expect(data.route.features.map((feature) => feature.properties.connector)).toEqual([true, false]);
    expect(data.route.features[0]!.geometry.coordinates[0]).toEqual([121, 25]);
  });
});
