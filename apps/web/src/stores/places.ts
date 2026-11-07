import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PlaceFeatureCollectionSchema, type PlaceCategory, type PlaceFeatureCollection } from '@app/shared';
import { apiGet } from '@/lib/api';

export const usePlacesStore = defineStore('places', () => {
  const collection = ref<PlaceFeatureCollection>({ type: 'FeatureCollection', features: [] });
  const loading = ref(false);
  const error = ref<string | null>(null);
  /** 只採用最後一次請求的結果：定位晚到時會連查兩次（市府中心 → 實際位置），舊的回應不能蓋掉新的 */
  let latest = 0;

  async function fetchNearby(params: { lat: number; lng: number; radius?: number; category?: PlaceCategory }) {
    const seq = ++latest;
    loading.value = true;
    error.value = null;
    try {
      const result = await apiGet('/api/v1/places', PlaceFeatureCollectionSchema, {
        lat: params.lat,
        lng: params.lng,
        radius: params.radius ?? 3000,
        category: params.category,
      });
      if (seq === latest) collection.value = result;
    } catch (err) {
      if (seq === latest) error.value = (err as Error).message;
    } finally {
      if (seq === latest) loading.value = false;
    }
  }

  return { collection, loading, error, fetchNearby };
});
