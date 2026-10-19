import { Navigate, useLocation, useParams } from 'react-router-dom';
import { COVER_LETTER_PATH, coverLetterLibraryPath } from '../../utils/coverLetterNavigation';

// Saved links keep the draft ID, query parameters and navigation state.
export default function LegacyCoverLetterRedirect({ library = false }) {
  const location = useLocation();
  const { '*': suffix = '' } = useParams();
  const query = new URLSearchParams(location.search);
  const target = library
    ? coverLetterLibraryPath(query.get('company') || location.state?.openCompany || '')
    : `${COVER_LETTER_PATH}/${suffix}${location.search}${location.hash}`;
  return <Navigate replace to={target} state={location.state} />;
}
