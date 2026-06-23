const { join } = require('path');

// Render 등 배포 환경에서 빌드 시 받은 Chrome이 런타임까지 보존되도록
// 캐시 위치를 프로젝트 디렉터리 내부로 고정한다. (기본값은 홈디렉터리 ~/.cache/puppeteer 라 배포 단계 간 유실될 수 있음)
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
