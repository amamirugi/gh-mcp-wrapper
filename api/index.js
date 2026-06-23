export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub for Claude</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    background: #0d0d0d;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  img {
    width: min(70vw, 70vh, 520px);
    height: auto;
    border-radius: 24px;
    user-select: none;
  }
</style>
</head>
<body>
  <img src="/og.webp" alt="GitHub for Claude">
</body>
</html>`);
}
