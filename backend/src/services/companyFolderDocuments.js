// Authenticated company operations move saved documents without changing their contents.
export async function companyDocumentsOf(db, uid, company) {
  const query = async (collection, deriveCompany) => {
    const snapshot = await db.collection(collection).where('userId', '==', uid).get();
    return snapshot.docs.filter(document => deriveCompany(document.data()).trim() === company);
  };
  const [portfolios, coverLetters] = await Promise.all([
    query('portfolios', data => String(data.targetCompany || '')),
    query('coverLetters', data => typeof data.targetCompany === 'string' ? data.targetCompany : String(data.analysis?.company || '')),
  ]);
  return { portfolios, coverLetters };
}

export function moveCompanyDocuments(batch, documents, targetCompany) {
  const updatedAt = new Date();
  [...documents.portfolios, ...documents.coverLetters].forEach(document => batch.update(document.ref, { targetCompany, updatedAt }));
  return { movedPortfolios: documents.portfolios.length, movedCoverLetters: documents.coverLetters.length };
}
