# DECISIONS

claude.ai 커스텀 커넥터용 GitHub MCP OAuth 래퍼(Vercel Edge). 프로젝트 상태·버전은 Notion `🚀 Projects`의 해당 행이 정본이다.

## 확정된 결정

- **상태 저장 없이 서명 토큰(HMAC-SHA256)을 유지한다.** DB·KV 없이 Vercel Edge 함수만으로 동작하는 구조를 지킨다.
- **OAuth 콜백 URI는 허용 목록으로 제한한다.** 기본값은 `https://claude.ai/api/mcp/auth_callback`과 `https://claude.com/api/mcp/auth_callback`이다. `ALLOWED_REDIRECT_URIS` env로 목록을 교체할 수 있다. RFC 8252 루프백(`http://localhost`, `127.0.0.1`, `[::1]`)은 네이티브 클라이언트용으로 항상 허용한다. `/register`와 `/authorize`(GET·POST)가 모두 이 목록을 검사한다.
- **PKCE는 S256만 받는다.** `/token`에서 `code_verifier`와 `redirect_uri` 일치를 필수로 확인한다. code에 `client_id`를 넣어 두고, 요청에 `client_id`가 있으면 대조한다.
- **토큰 수명**: code 120초, 액세스 1시간, 리프레시 30일(갱신할 때마다 연장), 최초 인가 후 최대 90일. 90일이 지나면 비밀번호를 다시 입력해야 한다.
- **`TOKEN_VERSION` env(기본 `1`)로 일괄 폐기한다.** 모든 토큰에 `kv` 클레임이 들어가고, 값이 다르면 거부한다. `SIGNING_SECRET`을 바꾸지 않아도 폐기할 수 있다.
- 비밀번호는 SHA-256 다이제스트를 상수 시간으로 비교하고, 실패하면 1초 지연한 뒤 응답한다.
- 인가 화면에 `frame-ancestors 'none'` CSP, `X-Frame-Options: DENY`, `no-store`, `no-referrer`를 붙인다. CSP `form-action`은 `'self'`와 검증을 통과한 `redirect_uri`의 출처를 함께 허용한다. 브라우저는 폼 제출 뒤 리다이렉트 대상에도 `form-action`을 적용하므로, `'self'`만 두면 비밀번호가 맞아도 콜백으로 넘어가지 못한다(2026-10-31 Chrome·Brave에서 발생, 같은 날 수정).

## 기각된 대안

- **코드만으로 시도 횟수 제한**: 상태 저장이 없어서 인스턴스 사이에 카운터를 공유할 수 없다. Vercel Firewall rate limit 규칙으로 처리한다(아래 실행 상태).
- **CORS `*` 축소**: 인증이 Bearer 헤더로만 오가고 쿠키를 쓰지 않아서 이번 범위에서 제외했다.
- **Cloudflare Access Managed OAuth로 이전**: Vercel → Workers 구조 변경이 필요해서 2026-10-31에는 코드 강화를 먼저 택했다.

## 실행 상태

- 2026-10-31 위 변경을 #1로 squash 머지했다(`b3f30e9`). 수정 파일은 `lib/oauth.js`(신규), `api/authorize.js`, `api/token.js`, `api/register.js`, `api/mcp.js`, `README.md`다.
- 로컬 Node 22로 핸들러를 직접 호출하는 시나리오 27건이 모두 통과했다: 허용·비허용 콜백, PKCE 누락·plain·불일치, client_id 불일치, 구형 토큰 거부, 90일 초과 리프레시 거부, 버전 변경 시 폐기, register 검증, env 교체. 테스트 스크립트는 리포에 넣지 않았다.
- 머지 전에 Vercel의 `GITHUB_PAT`(fine-grained, 만료 2027-10-31), `AUTH_PASSWORD`, `SIGNING_SECRET`을 모두 새 값으로 바꿨다. 머지로 생성된 production 배포가 새 값을 쓴다.
- production(`https://gh-mcp-wrapper.vercel.app`) 실측: AS 메타데이터 200, claude.ai 콜백 인가 화면 200, 비허용 콜백 400, PKCE `plain` 400, 비허용 콜백 등록 400, 토큰 없는 `/mcp` 401, 인가 화면 CSP·`X-Frame-Options` 헤더 확인.
- claude.ai 커넥터를 다시 연결한 뒤 리포 생성까지 도구 호출이 정상 동작하는 것을 확인했다.

- 2026-10-31 Vercel Firewall 규칙 `authorize POST rate limit`을 대시보드에서 만들었다: 경로가 `/authorize` 또는 `/api/authorize`이고 Method가 `POST`면 IP 기준 60초 고정 창 10회, 초과 시 429. 차단 연장 시간은 두지 않아 창이 바뀌면 풀린다. 브라우저 한 대에서 틀린 비밀번호를 반복 제출해 429 응답을 확인했다. 프로젝트 방화벽 설정이 없던 상태에서는 API(PUT·PATCH)가 404를 내서 대시보드로 처음 만들었고, 그 뒤에도 `GET /v1/security/firewall/config/active`는 404를 돌려준다. 규칙 확인은 대시보드 Firewall → Rules에서 한다.
- 2026-10-31 이전 PAT 2개는 태현이 GitHub에서 삭제했다.
- 2026-10-31 배포 보호·env 범위 점검: 배포 보호는 Vercel Authentication `all_except_custom_domains`다. production `gh-mcp-wrapper.vercel.app`은 공개(200)고 preview와 `git-main` 별칭은 Vercel SSO로 302다. 태현 승인으로 `GITHUB_PAT`·`AUTH_PASSWORD`·`SIGNING_SECRET`(sensitive)의 범위를 production+preview에서 **production 전용**으로 좁혔다(`GITHUB_TOOLSETS`는 원래 production 전용). 브랜치 push로 생기는 preview 배포에 PAT가 실리지 않게 하기 위해서다. 재조회로 범위를 확인했고 production 응답(AS 메타데이터 200, 토큰 없는 `/mcp` 401)은 그대로다. sensitive 값은 API로 읽을 수 없어 값 보존은 다음 production 배포에서 확인된다.

## 이어받을 다음 작업

- 다음 production 배포 뒤 커넥터 도구 호출이 정상인지 확인한다. 인증이 깨지면 2026-10-31 env 범위 변경을 먼저 의심하고 세 값을 다시 넣는다.
- preview 배포에는 비밀값이 없어 인증 흐름이 동작하지 않는다. preview에서 검증해야 하면 그때만 범위를 넓힌다.
- 그 밖에는 없음. 연결이 끊기면 claude.ai 커넥터를 다시 연결한다. 비밀번호를 10회 넘게 틀리면 1분 안에 풀린다.
