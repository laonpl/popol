# FitPoly 지원서 문항 연결

Chrome 또는 Edge에서 로그인·지원자 등록 뒤에 표시되는 자기소개서 문항을 가져오는 확장입니다. 실제 지원자 등록과 개인정보 동의는 지원 사이트에서 사용자가 직접 진행합니다.

1. FitPoly에서 받은 ZIP을 빈 폴더에 압축 해제합니다.
2. Chrome의 `chrome://extensions` 또는 Edge의 `edge://extensions`를 열고 개발자 모드를 켭니다.
3. **압축 해제된 확장 프로그램을 로드**를 눌러 `manifest.json`이 들어 있는 폴더를 선택합니다.
4. FitPoly 자소서 화면에서 **로그인한 지원서 연결**을 누릅니다.
5. 같은 브라우저의 해당 지원 사이트에서 로그인·등록하고 실제 자기소개서 입력 화면을 엽니다.
6. 브라우저 도구 모음의 FitPoly 확장을 열고 **이 화면의 문항 확인**을 누릅니다.
7. 실제 문항과 글자 수 제한을 비교하고 선택한 뒤 **FitPoly로 가져오기**를 누릅니다. 원래 FitPoly 탭으로 돌아가 확인합니다.

연결은 15분 뒤 끝납니다. 확장은 버튼을 누른 현재 탭의 문항과 글자 수 제한만 읽습니다. 작성한 답변, 이름, 연락처, 비밀번호, 쿠키는 읽거나 전송하지 않습니다. 서버로 로그인 정보를 보내지 않으며 제출·동의 버튼을 대신 누르지 않습니다.

지원서 구조에 따라 읽히지 않는 문항, 이미지로 된 문항, 다른 도메인의 프레임 안에 있는 문항은 직접 붙여넣어 확인할 수 있습니다.

개발자는 저장소의 `frontend` 폴더에서 `node scripts/package-application-connector.mjs`를 실행해 최신 수집기와 함께 ZIP 및 연결 설정을 생성할 수 있습니다. 확장 권한은 `activeTab`, `scripting`, `storage`입니다. `activeTab`은 사용자가 확장 아이콘을 직접 누른 탭에 한시적으로 적용됩니다. [Chrome 공식 문서](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
