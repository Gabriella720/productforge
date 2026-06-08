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

/** Manual session token takes priority over build-time env token. */
export const getStoredGitHubToken = () => {
  const sessionToken = typeof sessionStorage !== 'undefined'
    ? normalizeGitHubToken(sessionStorage.getItem(GH_TOKEN_SESSION) || '')
    : '';
  if (sessionToken) return sessionToken;
  return normalizeGitHubToken(import.meta.env.VITE_GITHUB_ANALYTICS_TOKEN || '');
};

export const validateGitHubTokenFormat = (token) => {
  const normalized = normalizeGitHubToken(token);
  if (!normalized) return { ok: false, error: '请先填写 GitHub Token。' };
  if (!/^(github_pat_|ghp_|gho_|ghu_|ghs_|ghr_)/i.test(normalized)) {
    return {
      ok: false,
      error: 'Token 格式不正确。请复制以 github_pat_ 开头的完整密钥（设置页里的名称 product_forge 不是 Token 本身）。',
    };
  }
  if (normalized.length < 40) {
    return { ok: false, error: 'Token 似乎不完整，请从 GitHub 重新完整复制。' };
  }
  return { ok: true, token: normalized };
};

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

export const getGitHubHeaders = (token, scheme = 'Bearer') => ({
  Accept: 'application/vnd.github+json',
  Authorization: `${scheme} ${normalizeGitHubToken(token)}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const fetchGitHub = async (url, token) => {
  const normalized = normalizeGitHubToken(token);
  let res = await fetch(url, { headers: getGitHubHeaders(normalized, 'Bearer') });
  if (res.status === 401) {
    res = await fetch(url, { headers: getGitHubHeaders(normalized, 'token') });
  }
  return res;
};

const parseGitHubError = async (res) => {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.message || text;
  } catch {
    return text || res.statusText;
  }
};

export const formatGitHubApiError = (status, message, { step } = {}) => {
  const detail = redactSecrets((message || '').toString());
  if (status === 401) {
    const stepHint = step === 'repo'
      ? '请确认 Token 已授权 productforge 仓库，且 Contents 为 Read and write。'
      : '请确认复制的是完整密钥（github_pat_...），不是设置页里的 Token 名称。';
    return `GitHub 认证失败（401）。Token 显示未过期也可能失败：① 复制了旧 Token 或复制不完整；② 粘贴了 Token 名称而非密钥；③ 重新生成 Token 后仍在使用旧字符串。${stepHint}`;
  }
  if (status === 403) {
    if (/resource not accessible|permission/i.test(detail)) {
      return 'Token 权限不足。Fine-grained PAT 需授予该仓库 Contents: Read and write，并选择 Repository access → Only select repositories → productforge。';
    }
    return `GitHub 拒绝访问 (403)：${detail}`;
  }
  if (status === 404) {
    if (step === 'contents') {
      return '仓库可访问，但目标文件路径不存在（404）。请检查 Branch / File Path，或继续尝试同步（首次会自动创建）。';
    }
    return `仓库或文件路径不存在 (404)。请检查 Owner、Repo、Branch、File Path 是否正确，以及 Token 的 Repository access 是否包含该仓库。`;
  }
  return redactSecrets(`${status} ${detail}`.trim());
};

const buildContentsUrl = ({ owner, repo, branch, path }) => {
  const ownerName = (owner || '').trim();
  const repoName = (repo || '').trim();
  const branchName = (branch || 'main').trim();
  const filePath = (path || 'src/site-data.json').trim();
  const apiPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `${GITHUB_API}/repos/${encodeURIComponent(ownerName)}/${encodeURIComponent(repoName)}/contents/${apiPath}?ref=${encodeURIComponent(branchName)}`;
};

/** Validate token via Contents API (same endpoint used for sync). */
export const checkGitHubCredentials = async ({
  token, owner, repo, branch = 'main', path = 'src/site-data.json',
}) => {
  const format = validateGitHubTokenFormat(token);
  if (!format.ok) return format;

  const normalized = format.token;
  const ownerName = (owner || '').trim();
  const repoName = (repo || '').trim();
  if (!ownerName || !repoName) {
    return { ok: false, error: '请填写 Owner 和 Repo。' };
  }

  const url = buildContentsUrl({ owner: ownerName, repo: repoName, branch, path });
  const res = await fetchGitHub(url, normalized);

  if (res.status === 404) {
    return {
      ok: true,
      login: ownerName,
      fileExists: false,
      diagnostics: {
        tokenLength: normalized.length,
        tokenPrefix: `${normalized.slice(0, 16)}...`,
        target: `${ownerName}/${repoName}@${branch}:${path}`,
      },
    };
  }

  if (!res.ok) {
    const msg = await parseGitHubError(res);
    const baseError = formatGitHubApiError(res.status, msg, {
      step: res.status === 404 ? 'contents' : 'repo',
    });
    return {
      ok: false,
      error: `${baseError}（HTTP ${res.status}，Token 长度 ${normalized.length}，目标 ${ownerName}/${repoName}）`,
      status: res.status,
      githubMessage: redactSecrets(msg),
    };
  }

  return {
    ok: true,
    login: ownerName,
    fileExists: true,
    diagnostics: {
      tokenLength: normalized.length,
      tokenPrefix: `${normalized.slice(0, 16)}...`,
      target: `${ownerName}/${repoName}@${branch}:${path}`,
    },
  };
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
    const authCheck = await checkGitHubCredentials({
      token: normalized, owner: ownerName, repo: repoName, branch: b, path: p,
    });
    if (!authCheck.ok) {
      return { ok: false, error: authCheck.error, status: authCheck.status || 401 };
    }
  }

  const apiPath = p.split('/').map(encodeURIComponent).join('/');
  const repoUrl = `${GITHUB_API}/repos/${encodeURIComponent(ownerName)}/${encodeURIComponent(repoName)}`;
  const getUrl = `${repoUrl}/contents/${apiPath}?ref=${encodeURIComponent(b)}`;

  let sha;
  const getRes = await fetchGitHub(getUrl, normalized);
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
    headers: { ...getGitHubHeaders(normalized), 'Content-Type': 'application/json' },
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
