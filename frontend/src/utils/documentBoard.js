export const DOCUMENT_STATES = ['draft', 'done', 'public'];

export function applyDocumentBoard(documents, entries) {
  return documents.map((document, index) => {
    const saved = entries[document.boardKey];
    return {
      ...document,
      status: DOCUMENT_STATES.includes(saved?.status) ? saved.status : document.status,
      order: Number.isFinite(saved?.order) ? saved.order : (index + 1) * 1024,
    };
  });
}

// Assign the moved card a position between its neighbours. Other cards, including
// cards hidden by a search filter, keep their saved positions.
export function documentMoveChange(document, destination, index, documents) {
  if (!DOCUMENT_STATES.includes(destination)) return null;
  const target = documents.filter(d => d.status === destination && d.boardKey !== document.boardKey);
  const at = Math.max(0, Math.min(index ?? target.length, target.length));
  const before = at > 0 ? target[at - 1].order : 0;
  const after = at < target.length ? target[at].order : before + 2048;
  const order = before + (after - before) / 2;
  return { key: document.boardKey, status: destination, order };
}

// Fractional ranks eventually run out of representable numbers when the same
// gap is used repeatedly. Re-space the full lane only at that boundary, keeping
// filtered cards in their relative order instead of colliding with their ranks.
export function documentMoveChanges(document, destination, index, documents, allDocuments = documents) {
  const change = documentMoveChange(document, destination, index, documents);
  if (!change) return [];
  const target = documents.filter(d => d.status === destination && d.boardKey !== document.boardKey);
  const at = Math.max(0, Math.min(index ?? target.length, target.length));
  const before = at > 0 ? target[at - 1].order : 0;
  const after = at < target.length ? target[at].order : before + 2048;
  if (Number.isFinite(change.order) && change.order > before && change.order < after && change.order <= 1_000_000_000) {
    return [change];
  }

  const lane = allDocuments
    .filter(d => d.status === destination && d.boardKey !== document.boardKey)
    .sort((a, b) => a.order - b.order);
  // Placing immediately before the next visible card preserves the requested
  // visible order, including when hidden cards occupy the exhausted gap.
  const nextKey = target[at]?.boardKey;
  const nextIndex = nextKey ? lane.findIndex(d => d.boardKey === nextKey) : -1;
  lane.splice(nextIndex < 0 ? lane.length : nextIndex, 0, document);
  return lane.map((item, position) => ({ key: item.boardKey, status: destination, order: (position + 1) * 1024 }));
}
