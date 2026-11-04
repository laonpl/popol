const reusableImport = importer => {
  let pending;
  return () => pending || (pending = importer().catch(error => { pending = null; throw error; }));
};

// Load only the destination the user points to, rather than every editor upfront.
export const appPageImports = {
  experienceHub: reusableImport(() => import('../pages/experience/ExperienceHub')),
  portfolioHub: reusableImport(() => import('../pages/portfolio/PortfolioHub')),
  experienceResult: reusableImport(() => import('../pages/experience/ExperienceResult')),
  structuredResult: reusableImport(() => import('../pages/experience/StructuredResult')),
  portfolioEditor: reusableImport(() => import('../pages/portfolio/NotionPortfolioEditor')),
  portfolioPreview: reusableImport(() => import('../pages/portfolio/NotionPortfolioPreview')),
  coverLetterWorkspace: reusableImport(() => import('../pages/coverletter/CoverLetterWorkspace')),
};

export function preloadAppRoute(path = '') {
  const pathname = path.split(/[?#]/)[0];
  const load = pathname === '/app/experience' ? appPageImports.experienceHub
    : pathname === '/app/portfolio' ? appPageImports.portfolioHub
    : /^\/app\/experience\/result\//.test(pathname) ? appPageImports.experienceResult
    : /^\/app\/experience\/structured\//.test(pathname) ? appPageImports.structuredResult
    : /^\/app\/portfolio\/edit(?:-notion)?\//.test(pathname) ? appPageImports.portfolioEditor
    : /^\/app\/portfolio\/preview\//.test(pathname) ? appPageImports.portfolioPreview
    : /^\/app\/coverletter\/(?:edit|new)(?:\/|$)/.test(pathname) ? appPageImports.coverLetterWorkspace : null;
  load?.().catch(() => {});
}

export function preloadLinkedRoute(event) {
  const link = event.target.closest?.('a[href]');
  if (link && link.origin === window.location.origin) preloadAppRoute(link.pathname);
}
