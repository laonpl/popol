import api from './api';

function makeSnap(id, data) {
  return {
    id,
    exists: () => !!data,
    data: () => data,
  };
}

export function doc(_db, collectionName, id) {
  return { type: 'doc', collectionName, id };
}

export function collection(_db, collectionName) {
  return { type: 'collection', collectionName };
}

export function where(field, operator, value) {
  return { field, operator, value };
}

export function query(collectionRef, ...constraints) {
  return { ...collectionRef, constraints };
}

export async function getDoc(ref) {
  if (ref.collectionName === 'experiences') {
    const { data } = await api.get(`/experience/${ref.id}`);
    return makeSnap(data.id || ref.id, data);
  }
  if (ref.collectionName === 'portfolios') {
    try {
      const { data } = await api.get(`/portfolio/${ref.id}`);
      return makeSnap(data.id || ref.id, data);
    } catch (error) {
      if ([401, 403, 404].includes(error.response?.status)) {
        const { data } = await api.get(`/portfolio/public/${ref.id}`);
        return makeSnap(data.id || ref.id, data);
      }
      throw error;
    }
  }
  throw new Error(`Unsupported collection: ${ref.collectionName}`);
}

export async function getDocs(ref) {
  if (ref.collectionName === 'experiences') {
    const { data } = await api.get('/experience/list');
    return { empty: !data?.length, docs: (data || []).map(item => makeSnap(item.id, item)) };
  }
  if (ref.collectionName === 'portfolios') {
    const slug = ref.constraints?.find(c => c.field === 'customSlug')?.value;
    if (slug) {
      try {
        const { data } = await api.get(`/portfolio/public/${slug}`);
        return { empty: false, docs: [makeSnap(data.id, data)] };
      } catch (error) {
        if ([403, 404].includes(error.response?.status)) return { empty: true, docs: [] };
        throw error;
      }
    }
    const { data } = await api.get('/portfolio/list');
    return { empty: !data?.length, docs: (data || []).map(item => makeSnap(item.id, item)) };
  }
  throw new Error(`Unsupported collection: ${ref.collectionName}`);
}

export async function updateDoc(ref, data) {
  if (ref.collectionName === 'experiences') {
    await api.patch(`/experience/${ref.id}`, data);
    return;
  }
  if (ref.collectionName === 'portfolios') {
    await api.patch(`/portfolio/${ref.id}`, data);
    return;
  }
  throw new Error(`Unsupported collection: ${ref.collectionName}`);
}
