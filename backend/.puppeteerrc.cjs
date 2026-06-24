const { join } = require('path');

/**
 * Render 등 PaaS에서 홈 디렉터리 캐시(~/.cache)는 빌드→런타임 간 보존되지 않아
 * 빌드 때 받은 Chrome을 런타임에서 못 찾는 문제가 있다.
 * 캐시를 프로젝트 내부(배포 시 함께 보존되는 경로)로 고정한다.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
