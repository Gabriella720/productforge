const GITHUB_API = 'https://api.github.com';
const GH_TOKEN_SESSION = 'ghToken';
const LEGACY_TOKEN_KEYS = ['ghTokenPersistent', 'ghRememberToken', 'ghTokenVault'];

/** Strip token-like strings from user-visible error text. */
export const redactSecrets = (text) => {
  const raw = (text || '').toString();
  return raw
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_TOKEN]')
    .replace(/ghp_[A-Za-z0-9]+/g, '[REDACTED_TOKEN]')
    .replace(/gho_[A-Za-z0-9]+/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');
};

const purgeLegacyTokenStorage = () => {
  if (typeof localStorage === 'undefined') return;
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
};

/** Remove accidental prefixes/quotes when pasting a PAT. */
export const normalizeGitHubToken = (raw) => {
  let token = (raw || '').toString().trim();
  if (!token) return '';
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, '').trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  return token.replace(/\s+/g, '');
};

/** Token only in sessionStorage for current tab session (manual input). */
export const getStoredGitHubToken = () => normalizeGitHubToken(
  import.meta.env.VITE_GITHUB_ANALYTICS_TOKEN ||
  (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GH_TOKEN_SESSION) : '') ||
  ''
);

export const clearGitHubTokenSession = () => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(GH_TOKEN_SESSION);
  }
  purgeLegacyTokenStorage();
};

export const saveGitHubToken = (rawToken) => {
  const token = normalizeGitHubToken(rawToken);
  purgeLegacyTokenStorage();
  if (typeof sessionStorage !== 'undefined') {
    if (token) sessionStorage.setItem(GH_TOKEN_SESSION, token);
    else sessionStorage.removeItem(GH_TOKEN_SESSION);
  }
  return token;
};

export const getGitHubPublishConfig = () => ({
  token: getStoredGitHubToken(),
  owner: (
    (typeof localStorage !== 'undefined' ? localStorage.getItem('ghOwner') : '') ||
    import.meta.env.VITE_GITHUB_ANALYTICS_OWNER ||
    'Gabriella720'
  ).trim(),
  repo: (
    (typeof localStorage !== 'undefined' ? localStorage.getItem('ghRepo') : '') ||
    import.meta.env.VITE_GITHUB_ANALYTICS_REPO ||
    'productforge'
  ).trim(),
  branch: (
    (typeof localStorage !== 'undefined' ? localStorage.getItem('ghBranch') : '') ||
    import.meta.env.VITE_GITHUB_ANALYTICS_BRANCH ||
    'main'
  ).trim(),
  path: (
    (typeof localStorage !== 'undefined' ? localStorage.getItem('ghPath') : '') ||
    'src/site-data.json'
  ).trim(),
});

export const getGitHubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${normalizeGitHubToken(token)}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const parseGitHubError = async (res) => {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.message || text;
  } catch {
    return text || res.statusText;
  }
};

export const formatGitHubApiError = (status, message) => {
  const detail = redactSecrets((message || '').toString());
  if (status === 401) {
    return 'Token 无效或已过期。请在 GitHub → Settings → Developer settings 重新生成 Fine-grained PAT，勾选 productforge 仓库的 Contents: Read and write 权限，并确认 Token 未过期。';
  }
  if (status === 403) {
    if (/resource not accessible|permission/i.test(detail)) {
      return 'Token 权限不足。Fine-grained PAT 需授予该仓库 Contents: Read and write，并选择 Repository access → Only select repositories → productforge。';
    }
    return `GitHub 拒绝访问 (403)：${detail}`;
  }
  if (status === 404) {
    return `仓库或文件路径不存在 (404)。请检查 Owner、Repo、Branch、File Path 是否正确。`;
  }
  return redactSecrets(`${status} ${detail}`.trim());
};

/** Quick auth + repo access check before publishing. */
export const checkGitHubCredentials = async ({ token, owner, repo }) => {
  const normalized = normalizeGitHubToken(token);
  if (!normalized) return { ok: false, error: '请先填写 GitHub Token。' };

  const ownerName = (owner || '').trim();
  const repoName = (repo || '').trim();
  if (!ownerName || !repoName) {
    return { ok: false, error: '请填写 Owner 和 Repo。' };
  }

  const headers = getGitHubHeaders(normalized);

  const userRes = await fetch(`${GITHUB_API}/user`, { headers });
  if (!userRes.ok) {
    const msg = await parseGitHubError(userRes);
    return { ok: false, error: formatGitHubApiError(userRes.status, msg) };
  }
  const user = await userRes.json();

  const repoRes = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(ownerName)}/${encodeURIComponent(repoName)}`,
    { headers }
  );
  if (!repoRes.ok) {
    const msg = await parseGitHubError(repoRes);
    return { ok: false, error: formatGitHubApiError(repoRes.status, msg) };
  }

  return { ok: true, login: user.login };
};

const base64EncodeUtf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const publishJsonToRepo = async ({
  token, owner, repo, branch, path, content, skipAuthCheck = false,
}) => {
  const normalized = normalizeGitHubToken(token);
  if (!normalized) return { ok: false, error: '请先填写 GitHub Token。', status: 401 };

  const b = (branch || 'main').toString().trim();
  const p = (path || 'src/site-data.json').toString().trim();
  const ownerName = (owner || '').trim();
  const repoName = (repo || '').trim();
  if (!ownerName || !repoName) return { ok: false, error: '请填写 Owner 和 Repo。', status: 400 };

  if (!skipAuthCheck) {
    const authCheck = await checkGitHubCredentials({ token: normalized, owner: ownerName, repo: repoName });
    if (!authCheck.ok) return { ok: false, error: authCheck.error, status: 401 };
  }

  const apiPath = p.split('/').map(encodeURIComponent).join('/');
  const repoUrl = `${GITHUB_API}/repos/${encodeURIComponent(ownerName)}/${encodeURIComponent(repoName)}`;
  const getUrl = `${repoUrl}/contents/${apiPath}?ref=${encodeURIComponent(b)}`;
  const headers = getGitHubHeaders(normalized);

  let sha;
  const getRes = await fetch(getUrl, { headers });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing?.sha;
  } else if (getRes.status !== 404) {
    const msg = await parseGitHubError(getRes);
    return { ok: false, error: formatGitHubApiError(getRes.status, msg), status: getRes.status };
  }

  const putUrl = `${repoUrl}/contents/${apiPath}`;
  const putBody = {
    message: `Update site data (${new Date().toISOString()})`,
    content: base64EncodeUtf8(typeof content === 'string' ? content : JSON.stringify(content)),
    branch: b,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const msg = await parseGitHubError(putRes);
    return { ok: false, error: formatGitHubApiError(putRes.status, msg), status: putRes.status };
  }

  const result = await putRes.json();
  return { ok: true, commitUrl: result?.commit?.html_url || '' };
};

export const detectGitHubPagesRepo = () => {
  try {
    const host = window.location.host;
    const path = window.location.pathname || '/';
    if (!host.endsWith('github.io')) return null;
    return {
      owner: host.replace(/\.github\.io$/i, ''),
      repo: path.split('/').filter(Boolean)[0] || '',
    };
  } catch {
    return null;
  }
};
