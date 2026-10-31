# DECISIONS

claude.ai 커스텀 커넥터용 GitHub MCP OAuth 래퍼(Vercel Edge). 프로젝트 상태·버전은 Notion `🚀 Projects`의 해당 행이 정본이다.

## 확정된 결정

- **상태 저장 없이 서명 토큰(HMAC-SHA256)을 유지한다.** DB·KV 없이 Vercel Edge 함수만으로 동작하는 구조를 지킨다.
- **OAuth 콜백 URI는 허용 목록으로 제한한다.** 기본값은 `https://claude.ai/api/mcp/auth_callback`과 `https://claude.com/api/mcp/auth_callback`이다. `ALLOWED_REDIRECT_URIS` env로 목록을 교체할 수 있다. RFC 8252 루프백(`http://localhost`, `127.0.0.1`, `[::1]`)은 네이티브 클라이언트용으로 항상 허용한다. `/register`와 `/authorize`(GET·POST)가 모두 이 목록을 검사한다.
- **PKCE는 S256만 받는다.** `/token`에서 `code_verifier`와 `redirect_uri` 일치를 필수로 확인한다. code에 `client_id`를 넣어 두고, 요청에 `client_id`가 있으면 대조한다.
- **토큰 수명**: code 120초, 액세스 1시간, 리프레시 30일(갱신할 때마다 연장), 최초 인가 후 최대 90일. 90일이 지나면 비밀번호를 다시 입력해야 한다.
- **`TOKEN_VERSION` env(기본 `1`)로 일괄 폐기한다.** 모든 토큰에 `kv` 클레임이 들어가고, 값이 다르면 거부한다. `SIGNING_SECRET`을 바꾸지 않아도 폐기할 수 있다.
- 비밀번호는 SHA-256 다이제스트를 상수 시간으로 비교하고, 실패하면 1초 지연한 뒤 응답한다.
- 인가 화면에 `frame-ancestors 'none'` CSP, `X-Frame-Options: DENY`, `no-store`, `no-referrer`를 붙인다.

## 기각된 대안

- **코드만으로 시도 횟수 제한**: 상태 저장이 없어서 인스턴스 사이에 카운터를 공유할 수 없다. 필요하면 Vercel Firewall rate limit 규칙으로 처리한다(미적용).
- **CORS `*` 축소**: 인증이 Bearer 헤더로만 오가고 쿠키를 쓰지 않아서 이번 범위에서 제외했다.
- **Cloudflare Access Managed OAuth로 이전**: Vercel → Workers 구조 변경이 필요해서 2026-10-31에는 코드 강화를 먼저 택했다.

## 실행 상태

- 2026-10-31 브랜치 `claude/epic-keller-12iu3x`(`1691c64`)에 위 변경을 커밋했다. 수정 파일은 `lib/oauth.js`(신규), `api/authorize.js`, `api/token.js`, `api/register.js`, `api/mcp.js`, `README.md`다.
- 로컬 Node 22로 핸들러를 직접 호출하는 시나리오 27건이 모두 통과했다: 허용·비허용 콜백, PKCE 누락·plain·불일치, client_id 불일치, 구형 토큰 거부, 90일 초과 리프레시 거부, 버전 변경 시 폐기, register 검증, env 교체. 테스트 스크립트는 리포에 넣지 않았다.
- Vercel preview 배포가 생성됐다. **production은 main `f4b4781` 그대로이고, main에 머지해야 반영된다.**
- 머지하면 기존 토큰(`kv` 클레임 없음)이 전부 무효가 된다. claude.ai 커넥터를 한 번 다시 연결해야 한다.

## 이어받을 다음 작업

1. 태현이 main에 머지한 뒤 claude.ai 커넥터를 다시 연결하고, 도구 호출이 되는지 확인한다.
2. (후보) 머지와 함께 `AUTH_PASSWORD`·`SIGNING_SECRET` 교체, GitHub PAT를 fine-grained 최소 권한으로 축소. 모두 태현이 직접 한다.
3. (후보) Vercel Firewall에 `/authorize` POST rate limit 규칙 추가.
