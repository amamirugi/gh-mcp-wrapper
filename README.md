# GitHub MCP Wrapper for claude.ai

claude.ai 웹/앱의 커스텀 커넥터에서 공식 GitHub MCP 서버에 붙기 위한 OAuth 래퍼.

## 왜 필요한가

claude.ai 커스텀 커넥터는 MCP OAuth 스펙(protected-resource 메타데이터, DCR,
PKCE, `https://claude.ai/api/mcp/auth_callback` 콜백)을 따르는 서버만 붙는다.
GitHub OAuth App을 그대로 꽂으면 이 디스커버리 흐름을 못 맞춰서 토큰 없이
호출 → 401 → "토큰 없음" 에러로 떨어진다.

이 래퍼는 앞단에서 claude.ai가 요구하는 OAuth를 충족하고(게이트는 비밀번호 하나),
통과하면 네 GitHub PAT를 달아서 공식 GitHub MCP(`api.githubcopilot.com/mcp/`)로
프록시한다. 공식 서버의 전체 툴셋(레포·이슈·PR·Actions·gist 읽기/쓰기)을 그대로 쓴다.

상태 저장은 서명된 토큰(HMAC-SHA256)으로 처리 → DB·외부 서비스 불필요.

## 1. GitHub PAT 발급

github.com/settings/tokens 에서 발급.

- Classic: `repo`, `read:org`, `workflow`, `gist` (쓰기까지 원하면 이 정도)
- Fine-grained: 대상 레포 + Contents/Issues/Pull requests/Actions = Read and write

발급된 토큰 문자열을 복사해둔다.

## 2. Vercel 배포

이 폴더를 GitHub 레포에 올린 뒤 Vercel에서 Import, 또는 CLI:

```
npm i -g vercel
vercel
vercel --prod
```

배포되면 도메인이 나온다. 예: `https://gh-mcp-wrapper.vercel.app`

### 환경변수 (Vercel → Project → Settings → Environment Variables)

| 이름 | 값 |
|------|----|
| `GITHUB_PAT` | 1단계에서 발급한 토큰 |
| `AUTH_PASSWORD` | 커넥터 연결 시 입력할 비밀번호 (직접 정함) |
| `SIGNING_SECRET` | 긴 랜덤 문자열 (`openssl rand -hex 32`) |

세 개 다 넣고 재배포(`vercel --prod`).

### 동작 확인

```
curl https://<도메인>/.well-known/oauth-authorization-server
```

JSON에 `authorization_endpoint`, `token_endpoint`, `registration_endpoint`가
보이면 정상.

## 3. claude.ai 커넥터 추가

설정 → 커넥터 → 커스텀 커넥터 추가:

- 이름: 아무거나 (예: GitHub)
- 원격 MCP 서버 URL: `https://<도메인>/mcp`
- 고급 설정의 OAuth 클라이언트 ID / 시크릿: **비워둔다** (DCR이 처리)

추가 → 연결(Connect) → 브라우저에 비밀번호 입력창 → `AUTH_PASSWORD` 입력 →
승인되면 툴 활성화.

## 엔드포인트

| 경로 | 역할 |
|------|------|
| `/.well-known/oauth-protected-resource` | RFC 9728 메타데이터 |
| `/.well-known/oauth-authorization-server` | AS 메타데이터 |
| `/register` | Dynamic Client Registration |
| `/authorize` | 비밀번호 게이트 + 코드 발급 |
| `/token` | 코드/리프레시 → 액세스 토큰 |
| `/mcp` | 토큰 검증 후 공식 GitHub MCP로 프록시 |

## 주의

- claude.ai 커스텀 커넥터 OAuth 자체에 알려진 버그가 있다(인증 후 후속 요청에
  Authorization 헤더 누락 등). 래퍼가 정상이어도 claude.ai 쪽 이슈로 한 번에 안
  붙을 수 있다. 그 경우 커넥터 삭제 후 재추가, 새 대화에서 재시도.
- PAT는 GitHub에서 만료/스코프 조정 가능. 만료되면 Vercel 환경변수만 교체.
- 단일 사용자 전제. URL이 노출돼도 비밀번호가 게이트지만, `SIGNING_SECRET`과
  `AUTH_PASSWORD`는 충분히 길게.
