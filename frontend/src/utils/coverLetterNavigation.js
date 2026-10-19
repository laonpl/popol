export const COVER_LETTER_PATH = '/app/portfolio/coverletter';

export function coverLetterLibraryPath(company = '') {
  const query = new URLSearchParams({ type: 'cover' });
  if (company.trim()) query.set('company', company.trim());
  return `/app/portfolio?${query}`;
}

export function newCoverLetterPath(company = '') {
  return `${COVER_LETTER_PATH}/new${company.trim() ? `?${new URLSearchParams({ company: company.trim() })}` : ''}`;
}

export function editCoverLetterPath(id) {
  return `${COVER_LETTER_PATH}/edit/${encodeURIComponent(id)}`;
}
