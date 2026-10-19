// The cabinet now uses a document list. Run its current navigation, folder,
// search/sort, autosave, scroll and responsive checks with mocked account APIs.
process.env.DOCUMENT_REVIEW_ORIGIN ||= process.argv[2] || 'http://127.0.0.1:3100';
await import('./review-integrated-documents.mjs');
