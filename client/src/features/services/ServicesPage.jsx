import { useEffect, useMemo, useState } from 'react';

const cleanJson = (text) => {
  if (!text) return '';
  return text.replace(/^[\uFEFF\u200B]+/, '').replace(/^[;]+/, '').trim();
};

const parseUrlParts = (rawUrl) => {
  if (!rawUrl) return { baseUrl: '', params: [] };
  const sanitize = rawUrl.trim();
  let baseUrl = sanitize;
  let params = [];
  const parseQuery = (query = '') =>
    query
      .replace(/^\?/, '')
      .split('&')
      .filter(Boolean)
      .map((part, idx) => {
        const [k = '', v = ''] = part.split('=');
        return {
          id: `p-${idx}-${k || 'param'}`,
          key: decodeURIComponent(k),
          value: decodeURIComponent(v),
          active: true,
        };
      });

  try {
    const urlObj = new URL(sanitize);
    baseUrl = `${urlObj.origin}${urlObj.pathname}`;
    params = Array.from(urlObj.searchParams.entries()).map(([k, v], idx) => ({
      id: `p-${idx}-${k || 'param'}`,
      key: k,
      value: v,
      active: true,
    }));
  } catch {
    const [base, queryString] = sanitize.split('?');
    baseUrl = base;
    params = parseQuery(queryString);
  }

  return { baseUrl, params };
};

const resolveTemplateString = (str = '', vars = []) => {
  if (!str) return '';
  const map = new Map(vars.filter((v) => v.key).map((v) => [v.key, v.value || '']));
  return str.replace(/{{\s*([^}\s]+)\s*}}/g, (match, key) => (map.has(key) ? map.get(key) : match));
};

const buildUrlWithParams = (baseUrl, params = []) => {
  const activeParams = params.filter((p) => p.active && p.key);
  if (!activeParams.length) return baseUrl || '';
  const query = activeParams
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
    .join('&');
  return `${baseUrl || ''}?${query}`;
};

const normalizeRequests = (collection) => {
  if (!collection) return { requests: [], tree: [] };
  const requests = [];
  const items = collection.item || [];

  const buildTree = (arr, parent = '') =>
    arr.map((it) => {
      if (it.item) {
        return {
          id: crypto.randomUUID(),
          type: 'folder',
          name: it.name || 'Folder',
          children: buildTree(it.item, parent ? `${parent}/${it.name || ''}` : it.name || ''),
        };
      }

      const req = it.request || {};
      const headers = (req.header || []).map((h, idx) => ({
        id: `${it.name || 'h'}-${idx}`,
        key: h.key,
        value: h.value,
        active: h.disabled !== true,
      }));
      const rawUrl =
        typeof req.url === 'string'
          ? req.url
          : req.url?.raw ||
            [req.url?.protocol, '://', req.url?.host?.join('.'), req.url?.path?.join('/')].join('');
      const { baseUrl, params } = parseUrlParts(rawUrl || '');
      const authType = req.auth?.type || collection?.auth?.type;
      let bearer = '';
      if (authType === 'bearer') {
        const bearerVal = req.auth?.bearer?.find((b) => b.key === 'token') || req.auth?.bearer?.[0];
        bearer = bearerVal?.value || '';
      }
      const body =
        req.body?.mode === 'raw'
          ? req.body.raw || ''
          : req.body?.mode === 'urlencoded'
          ? JSON.stringify(req.body.urlencoded || [], null, 2)
          : req.body?.mode === 'formdata'
          ? JSON.stringify(req.body.formdata || [], null, 2)
          : '';

      const id = it.id || crypto.randomUUID();
      const responses = (it.response || []).map((res, idx) => ({
        id: `${id}-resp-${idx}`,
        name: res.name || res.status || 'Response',
        code: res.code,
        status: res.status,
        body: res.body || '',
      }));

      const requestEntry = {
        id,
        name: it.name || 'Unnamed',
        method: req.method || 'GET',
        url: baseUrl || '',
        params,
        headers,
        body,
        authType,
        bearer,
        folder: parent,
        responses,
      };
      requests.push(requestEntry);

      return {
        id,
        type: 'request',
        name: requestEntry.name,
        method: requestEntry.method,
        responses,
      };
    });

  return { requests, tree: buildTree(items) };
};

const normalizeFolders = (raw = []) => {
  const ensureArray = Array.isArray(raw) ? raw : [];
  const mapped = ensureArray.map((f) => {
    if (!f) return null;
    if (typeof f === 'string') return { name: f, vars: [] };
    return {
      name: f.name || 'Folder',
      vars: Array.isArray(f.vars)
        ? f.vars.map((v, idx) => ({ id: v.id || `var-${idx}-${v.key || 'k'}`, key: v.key || '', value: v.value || '' }))
        : [],
    };
  });
  const byName = new Map();
  mapped.filter(Boolean).forEach((f) => {
    if (!byName.has(f.name)) byName.set(f.name, f);
  });
  return Array.from(byName.values());
};

const buildTreeFromRequests = (list = [], extraFolders = []) => {
  const root = [];
  const folders = {};

  const ensureFolder = (parts, depth, parentArray) => {
    const key = parts.slice(0, depth + 1).join('/');
    if (!folders[key]) {
      const node = {
        id: key || `root-${depth}`,
        type: 'folder',
        name: parts[depth] || 'Root',
        children: [],
      };
      folders[key] = node;
      parentArray.push(node);
    }
    return folders[key];
  };

  list.forEach((req) => {
    const path = (req.folder || '').split('/').filter(Boolean);
    let parent = { children: root };
    path.forEach((part, idx) => {
      parent = ensureFolder(path.slice(0, idx + 1), idx, parent.children);
    });
    parent.children.push({
      id: req.id,
      type: 'request',
      name: req.name,
      method: req.method,
      responses: req.responses || [],
    });
  });

  extraFolders
    .filter(Boolean)
    .forEach((path) => {
      const parts = path.split('/').filter(Boolean);
      let parent = { children: root };
      parts.forEach((part, idx) => {
        parent = ensureFolder(parts.slice(0, idx + 1), idx, parent.children);
      });
    });

  return root.length
    ? root
    : list.map((req) => ({
      id: req.id,
      type: 'request',
      name: req.name,
      method: req.method,
      responses: req.responses || [],
  }));
};

function ServicesPage() {
  // API base: prefer explicit env (excluding docker-only hosts), otherwise fall back to localhost:4000 for dev.
  const rawApi = (import.meta.env.VITE_API_URL_BROWSER || import.meta.env.VITE_API_URL || '').trim();
  const apiBase = !rawApi || rawApi.includes('node_api') ? 'http://localhost:4000' : rawApi;
  const buildApi = (path) => `${apiBase}${path}`;
  const [requests, setRequests] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [activeTab, setActiveTab] = useState('params');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState({ status: '', time: '', body: '' });
  const [error, setError] = useState('');
  const [tree, setTree] = useState([]);
  const [openNodes, setOpenNodes] = useState({});
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pmFolders') || '[]');
      return normalizeFolders(stored);
    } catch {
      return [];
    }
  });
  const [newFolder, setNewFolder] = useState('');
  const [folderEditor, setFolderEditor] = useState(null);
  const [certificates, setCertificates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pmCertificates') || '{"ca": {"enabled": false, "path": ""}, "clients": []}');
    } catch {
      return { ca: { enabled: false, path: '' }, clients: [] };
    }
  });
  const [newCert, setNewCert] = useState({ host: '', pfx: '', passphrase: '', enabled: true });

  useEffect(() => {
    // Load sample collection from public folder if available
    const loadSample = async () => {
      try {
        setLoading(true);
        const svcRes = await fetch(buildApi('/api/services'));
        if (svcRes.ok) {
          const data = await svcRes.json();
          if (data.length) {
            setRequests(data);
            const folderSet = normalizeFolders([...folders, ...data.map((r) => r.folder).filter(Boolean)]);
            setFolders(folderSet);
            setTree(buildTreeFromRequests(data, folderSet.map((f) => f.name)));
            setActiveId(data[0]?.id || '');
            setLoading(false);
            return;
          }
        }
        const res = await fetch('/postmain.json');
        const txt = await res.text();
        importCollection(txt, true);
      } catch {
        // ignore if not found
      } finally {
        setLoading(false);
      }
    };
    loadSample();
  }, []);

  const activeRequest = useMemo(
    () => requests.find((r) => r.id === activeId) || requests[0],
    [requests, activeId]
  );

  useEffect(() => {
    localStorage.setItem('pmFolders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('pmCertificates', JSON.stringify(certificates));
  }, [certificates]);

  const updateTreeWithFolders = (nextRequests, nextFolders = folders) => {
    setTree(buildTreeFromRequests(nextRequests, nextFolders.map((f) => f.name)));
  };

  const addFolder = () => {
    const name = newFolder.trim().replace(/\/+/g, '/');
    if (!name) return;
    if (folders.find((f) => f.name === name)) {
      setNewFolder('');
      return;
    }
    const next = [...folders, { name, vars: [] }];
    setFolders(next);
    updateTreeWithFolders(requests, next);
    setNewFolder('');
  };

  const deleteFolder = (folderName) => {
    const nextFolders = folders.filter((f) => f.name !== folderName);
    const updatedRequests = requests.map((r) =>
      r.folder === folderName || r.folder?.startsWith(`${folderName}/`) ? { ...r, folder: '' } : r
    );
    setFolders(nextFolders);
    setRequests(updatedRequests);
    updateTreeWithFolders(updatedRequests, nextFolders);
    if (activeRequest?.folder === folderName) {
      setActiveId(updatedRequests[0]?.id || '');
    }
    if (folderEditor?.original === folderName) setFolderEditor(null);
  };

  const startEditFolder = (folder) => {
    setFolderEditor({
      original: folder.name,
      name: folder.name,
      vars: folder.vars.map((v) => ({ ...v })),
    });
  };

  const updateFolderEditorVar = (idx, patch) => {
    setFolderEditor((prev) => {
      const vars = prev.vars.map((v, i) => (i === idx ? { ...v, ...patch } : v));
      return { ...prev, vars };
    });
  };

  const addFolderVar = () => {
    setFolderEditor((prev) => ({
      ...prev,
      vars: [...prev.vars, { id: crypto.randomUUID(), key: '', value: '' }],
    }));
  };

  const removeFolderVar = (id) => {
    setFolderEditor((prev) => ({ ...prev, vars: prev.vars.filter((v) => v.id !== id) }));
  };

  const saveFolderEditor = () => {
    if (!folderEditor?.name.trim()) return;
    const cleanName = folderEditor.name.trim().replace(/\/+/g, '/');
    const vars = folderEditor.vars.filter((v) => v.key);
    const nextFolders = folders.map((f) =>
      f.name === folderEditor.original ? { ...f, name: cleanName, vars } : f
    );
    const updatedRequests = requests.map((r) =>
      r.folder === folderEditor.original ? { ...r, folder: cleanName } : r
    );
    setFolders(nextFolders);
    setRequests(updatedRequests);
    updateTreeWithFolders(updatedRequests, nextFolders);
    setFolderEditor(null);
  };

  const importCollection = async (rawText, persist = false) => {
    try {
      const cleaned = cleanJson(rawText);
      const parsed = JSON.parse(cleaned);
      const { requests: nextRequests } = normalizeRequests(parsed);
      if (persist) {
        await saveImportedRequests(nextRequests);
      } else {
        setRequests(nextRequests);
        const folderSet = normalizeFolders([...folders, ...nextRequests.map((r) => r.folder).filter(Boolean)]);
        setFolders(folderSet);
        updateTreeWithFolders(nextRequests, folderSet);
        setActiveId(nextRequests[0]?.id || '');
      }
      setActiveTab('params');
      setError('');
    } catch (e) {
      setError('הקובץ לא נקלט, ודא שפורמט ה-JSON תקין.');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    importCollection(text, true);
  };

  const toggleNode = (id) => {
    setOpenNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectExample = (res) => {
    setResponse({ status: `${res.code || ''} ${res.status || res.name || ''}`, time: '', body: res.body || '' });
  };

  const renderTreeNode = (node, depth = 0) => {
    const padding = 10 + depth * 14;
    if (node.type === 'folder') {
      const isOpen = openNodes[node.id] ?? true;
      return (
        <div key={node.id} className="pm-tree-folder">
          <button
            type="button"
            className="pm-folder-row"
            style={{ paddingInlineStart: padding }}
            onClick={() => toggleNode(node.id)}
          >
            <span className="pm-folder-caret">{isOpen ? '▾' : '▸'}</span>
            <span className="pm-title">{node.name}</span>
          </button>
          {isOpen && (
            <div className="pm-tree-children">
              {node.children?.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (node.type === 'request') {
      return (
        <div key={node.id} className="pm-tree-request">
          <button
            type="button"
            className={`pm-collection-row ${activeId === node.id ? 'active' : ''}`}
            style={{ paddingInlineStart: padding }}
            onClick={() => {
              setActiveId(node.id);
              setActiveTab('params');
            }}
          >
            <div className="pm-pill">{node.method}</div>
          <div className="pm-collection-meta">
            <div className="pm-title">{node.name}</div>
          </div>
        </button>
          {node.responses?.length ? (
            <div className="pm-tree-responses">
              {node.responses.map((res) => (
                <button
                  type="button"
                  key={res.id}
                  className="pm-response-row"
                  style={{ paddingInlineStart: padding + 24 }}
                  onClick={() => handleSelectExample(res)}
                >
                  <span className="pm-status-chip">{res.code || ''}</span>
                  <span className="pm-response-name">{res.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const updateActive = (patch) => {
    setRequests((prev) => {
      const next = prev.map((r) => (r.id === activeRequest?.id ? { ...r, ...patch } : r));
      updateTreeWithFolders(next);
      return next;
    });
  };

  const updateHeader = (idx, patch) => {
    if (!activeRequest) return;
    const nextHeaders = activeRequest.headers.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    updateActive({ headers: nextHeaders });
  };

  const addHeaderRow = () => {
    if (!activeRequest) return;
    const next = [
      ...activeRequest.headers,
      { id: crypto.randomUUID(), key: '', value: '', active: true },
    ];
    updateActive({ headers: next });
  };

  const updateParam = (idx, patch) => {
    if (!activeRequest) return;
    const next = (activeRequest.params || []).map((p, i) => (i === idx ? { ...p, ...patch } : p));
    updateActive({ params: next });
  };

  const addParamRow = () => {
    if (!activeRequest) return;
    const next = [
      ...(activeRequest.params || []),
      { id: crypto.randomUUID(), key: '', value: '', active: true },
    ];
    updateActive({ params: next });
  };

  const handleUrlChange = (val) => {
    const { baseUrl, params } = parseUrlParts(val);
    updateActive({ url: baseUrl, params });
  };

  const sendRequest = async () => {
    if (!activeRequest) return;
    setSending(true);
    setResponse({ status: '', time: '', body: '' });
    setError('');
    const start = performance.now();
    try {
      const headers = {};
      activeRequest.headers
        .filter((h) => h.active && h.key)
        .forEach((h) => {
          headers[h.key] = h.value;
        });
      if (activeRequest.bearer) {
        headers.Authorization = `Bearer ${activeRequest.bearer}`;
      }

      const options = {
        method: activeRequest.method || 'GET',
        headers,
      };

      if (
        activeRequest.body &&
        activeRequest.method !== 'GET' &&
        activeRequest.method !== 'HEAD'
      ) {
        options.body = activeRequest.body;
      }

      const activeFolder = folders.find((f) => f.name === activeRequest.folder);
      const resolvedBase = resolveTemplateString(activeRequest.url, activeFolder?.vars);
      const finalUrl = buildUrlWithParams(resolvedBase, activeRequest.params);
      const res = await fetch(finalUrl, options);
      const time = Math.round(performance.now() - start);
      const contentType = res.headers.get('content-type') || '';
      const body =
        contentType.includes('application/json')
          ? JSON.stringify(await res.json(), null, 2)
          : await res.text();
      setResponse({ status: `${res.status} ${res.statusText}`, time: `${time}ms`, body });
    } catch (e) {
      setError(e.message || 'שגיאה בשליחת הבקשה');
    } finally {
      setSending(false);
    }
  };

  const saveImportedRequests = async (items) => {
    try {
      const res = await fetch(buildApi('/api/services/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: items }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
        const folderSet = Array.from(new Set([...folders, ...data.map((r) => r.folder).filter(Boolean)]));
        setFolders(folderSet);
        updateTreeWithFolders(data, folderSet);
        setActiveId(data[0]?.id || '');
        return;
      }
    } catch {
      /* fallback below */
    }
    setRequests(items);
    setTree(buildTreeFromRequests(items));
    setActiveId(items[0]?.id || '');
  };

  const persistActive = async () => {
    if (!activeRequest) return;
    const payload = { ...activeRequest };
    const exists = requests.some((r) => r.id === activeRequest.id);
    const res = await fetch(
      exists ? buildApi(`/api/services/${activeRequest.id}`) : buildApi('/api/services'),
      {
        method: exists ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      const saved = await res.json();
      setRequests((prev) => {
        const filtered = prev.filter((r) => r.id !== saved.id);
        const next = [saved, ...filtered];
        const folderSet = Array.from(new Set([...folders, ...next.map((r) => r.folder).filter(Boolean)]));
        setFolders(folderSet);
        updateTreeWithFolders(next, folderSet);
        return next;
      });
      setActiveId(saved.id);
    } else {
      setError('שמירה נכשלה (בדוק שרת/DB)');
    }
  };

  const handleDeleteRequest = async (id) => {
    setSending(true);
    try {
      await fetch(buildApi(`/api/services/${id}`), { method: 'DELETE' });
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
    setRequests((prev) => {
      const next = prev.filter((r) => r.id !== id);
      updateTreeWithFolders(next);
      if (activeId === id) {
        setActiveId(next[0]?.id || '');
      }
      return next;
    });
  };

  const handleDuplicateRequest = async (id) => {
    try {
      const res = await fetch(buildApi(`/api/services/${id}/duplicate`), { method: 'POST' });
      if (res.ok) {
        const dup = await res.json();
        setRequests((prev) => {
          const next = [dup, ...prev];
          updateTreeWithFolders(next);
          return next;
        });
        setActiveId(dup.id);
      } else {
        setError('שכפול נכשל');
      }
    } catch {
      setError('שכפול נכשל');
    }
  };

  const renderTabContent = () => {
    if (!activeRequest) return null;
    const activeFolder = folders.find((f) => f.name === activeRequest.folder);
    if (activeTab === 'params') {
      return (
        <div className="grid-table">
          <div className="grid-head">
            <span>Key</span>
            <span>Value</span>
            <span>פעיל</span>
          </div>
          {(activeRequest.params || []).map((p, idx) => (
            <div className="grid-row" key={p.id}>
              <input
                type="text"
                value={p.key}
                onChange={(e) => updateParam(idx, { key: e.target.value })}
                placeholder="query"
              />
              <input
                type="text"
                value={p.value}
                onChange={(e) => updateParam(idx, { value: e.target.value })}
                placeholder="value"
              />
              <input
                type="checkbox"
                checked={p.active}
                onChange={(e) => updateParam(idx, { active: e.target.checked })}
                aria-label="הפעל פרמטר"
              />
            </div>
          ))}
          <button type="button" className="ghost" onClick={addParamRow}>
            הוסף פרמטר
          </button>
          {!activeRequest.params?.length && (
            <p className="muted small">אין פרמטרי שאילתה בבקשה הזו.</p>
          )}
        </div>
      );
    }

    if (activeTab === 'auth') {
      return (
        <div className="stack">
          <div className="form-grid">
            <label>
              סוג הרשאה
              <input type="text" value={activeRequest.authType || 'bearer'} readOnly />
            </label>
            <label className="full">
              Bearer Token
              <input
                type="text"
                value={activeRequest.bearer}
                onChange={(e) => updateActive({ bearer: e.target.value })}
                placeholder="eyJhbGciOi..."
              />
            </label>
          </div>
          <p className="muted small">מילוי טוקן יוסיף כותרת Authorization אוטומטית.</p>
        </div>
      );
    }

    if (activeTab === 'headers') {
      return (
        <div className="stack">
          <div className="grid-table">
            <div className="grid-head">
              <span>Header</span>
              <span>Value</span>
              <span>פעיל</span>
            </div>
            {activeRequest.headers.map((h, idx) => (
              <div className="grid-row" key={h.id}>
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(idx, { key: e.target.value })}
                  placeholder="Header"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(idx, { value: e.target.value })}
                  placeholder="ערך"
                />
                <input
                  type="checkbox"
                  checked={h.active}
                  onChange={(e) => updateHeader(idx, { active: e.target.checked })}
                  aria-label="הפעל כותרת"
                />
              </div>
            ))}
          </div>
          <div className="actions align-start">
            <button type="button" className="ghost" onClick={addHeaderRow}>
              הוסף Header
            </button>
            {!activeRequest.headers.length && (
              <p className="muted small">אין כותרות בקובץ. אפשר להוסיף ידנית.</p>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'certs') {
      return (
        <div className="stack">
          <div className="card soft">
            <div className="card-head">
              <div>
                <p className="eyebrow">CA Certificates</p>
                <h4>קובץ PEM</h4>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={certificates.ca?.enabled}
                  onChange={(e) =>
                    setCertificates((p) => ({ ...p, ca: { ...p.ca, enabled: e.target.checked } }))
                  }
                />
                <span>פעיל</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="נתיב לקובץ PEM (למשל /path/ca.pem)"
              value={certificates.ca?.path || ''}
              onChange={(e) =>
                setCertificates((p) => ({ ...p, ca: { ...p.ca, path: e.target.value } }))
              }
            />
            <p className="muted small">שמור את הנתיב; העלאה אמיתית תתבצע בכלי שלך.</p>
          </div>

          <div className="card soft">
            <div className="card-head">
              <div>
                <p className="eyebrow">Client Certificates</p>
                <h4>ניהול לפי Host</h4>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (!newCert.host || !newCert.pfx) return;
                  setCertificates((p) => ({
                    ...p,
                    clients: [
                      ...p.clients,
                      { ...newCert, id: crypto.randomUUID() },
                    ],
                  }));
                  setNewCert({ host: '', pfx: '', passphrase: '', enabled: true });
                }}
              >
                הוסף תעודה
              </button>
            </div>
            <div className="form-grid">
              <label>
                Host
                <input
                  type="text"
                  value={newCert.host}
                  onChange={(e) => setNewCert((p) => ({ ...p, host: e.target.value }))}
                  placeholder="api.example.com"
                />
              </label>
              <label>
                PFX file
                <input
                  type="text"
                  value={newCert.pfx}
                  onChange={(e) => setNewCert((p) => ({ ...p, pfx: e.target.value }))}
                  placeholder="/path/cert.pfx"
                />
              </label>
              <label>
                Passphrase
                <input
                  type="password"
                  value={newCert.passphrase}
                  onChange={(e) => setNewCert((p) => ({ ...p, passphrase: e.target.value }))}
                  placeholder="•••••"
                />
              </label>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={newCert.enabled}
                  onChange={(e) => setNewCert((p) => ({ ...p, enabled: e.target.checked }))}
                />
                פעיל
              </label>
            </div>

            <div className="stack" style={{ marginTop: '12px' }}>
              {certificates.clients?.map((c) => (
                <div key={c.id} className="pm-cert-row">
                  <div>
                    <div className="pm-title">{c.host || 'ללא Host'}</div>
                    <p className="muted small">{c.pfx || '—'}</p>
                  </div>
                  <div className="actions inline-actions">
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) =>
                          setCertificates((p) => ({
                            ...p,
                            clients: p.clients.map((cc) =>
                              cc.id === c.id ? { ...cc, enabled: e.target.checked } : cc
                            ),
                          }))
                        }
                      />
                      פעיל
                    </label>
                    <button
                      type="button"
                      className="ghost danger"
                      onClick={() =>
                        setCertificates((p) => ({
                          ...p,
                          clients: p.clients.filter((cc) => cc.id !== c.id),
                        }))
                      }
                    >
                      הסר
                    </button>
                  </div>
                </div>
              ))}
              {!certificates.clients?.length && <p className="muted small">אין תעודות לקוח מוגדרות.</p>}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="stack">
        <label className="full">
          גוף (raw)
          <textarea
            rows={6}
            value={activeRequest.body}
            onChange={(e) => updateActive({ body: e.target.value })}
            placeholder='{\n  "name": "John"\n}'
          />
        </label>
        <p className="muted small">
          כתובת עם משתנים: {activeRequest.url || '—'}{' '}
          {activeFolder?.vars?.length ? `(פתרון: ${buildUrlWithParams(resolveTemplateString(activeRequest.url, activeFolder.vars), activeRequest.params)})` : ''}
        </p>
      </div>
    );
  };

  return (
    <div className="postman-layout">
      <aside className="pm-sidebar">
        <div className="pm-sidebar-head">
          <div>
            <div className="pm-eyebrow">Collections</div>
            <h3>Postman Clone</h3>
          </div>
          <label className="pill-btn">
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            ייבוא
          </label>
        </div>

        <div className="pm-sidebar-actions">
          <div className="stack" style={{ width: '100%' }}>
            <div className="form-grid">
              <label className="full">
                תיקיות
                <div className="actions" style={{ gap: '8px' }}>
                  <input
                    type="text"
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    placeholder="לדוגמה: QA / DEV"
                  />
                  <button type="button" className="ghost small" onClick={addFolder}>
                    הוסף תיקיה
                  </button>
                </div>
              </label>
            </div>
            <div className="pm-folder-list full-width">
              {folders.map((f) => (
                <div key={f.name} className="pm-folder-item">
                  <span>{f.name}</span>
                  <div className="actions inline-actions">
                    <button type="button" className="ghost" title="ערוך תיקיה" onClick={() => startEditFolder(f)}>
                      ✏️
                    </button>
                    <button type="button" className="ghost danger" onClick={() => deleteFolder(f.name)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {!folders.length && <p className="muted small">אין תיקיות, הוסף כדי לארגן בקשות.</p>}
            </div>
          </div>
          <button
            type="button"
            className="ghost small"
            onClick={() => importCollection(cleanJson(JSON.stringify({}, null, 2)), true)}
          >
            נקה הכל
          </button>
        </div>

        <div className="pm-collections">
          {tree.map((node) => renderTreeNode(node, 0))}
          {!requests.length && <p className="muted small">טרם נטען קובץ Postman.</p>}
        </div>
      </aside>
      {folderEditor && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="card-head">
              <div>
                <p className="eyebrow">עריכת תיקיה</p>
                <h3>{folderEditor.original}</h3>
              </div>
              <div className="actions inline-actions">
                <button type="button" className="ghost danger" onClick={() => deleteFolder(folderEditor.original)}>
                  מחק
                </button>
                <button type="button" className="ghost" onClick={() => setFolderEditor(null)}>
                  סגור
                </button>
              </div>
            </div>
            <div className="stack">
              <label>
                שם תיקיה
                <input
                  type="text"
                  value={folderEditor.name}
                  onChange={(e) => setFolderEditor((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <div className="actions inline-actions" style={{ justifyContent: 'space-between' }}>
                <span className="muted small">
                  Variables (לשימוש בכתובת כ- {'{{key}}'})
                </span>
                <button type="button" className="ghost small" onClick={addFolderVar}>
                  הוסף משתנה
                </button>
              </div>
              <div className="grid-table">
                <div className="grid-head">
                  <span>Key</span>
                  <span>Value</span>
                  <span>פעולות</span>
                </div>
                {folderEditor.vars.map((v, idx) => (
                  <div className="grid-row" key={v.id}>
                    <input
                      type="text"
                      value={v.key}
                      onChange={(e) => updateFolderEditorVar(idx, { key: e.target.value })}
                      placeholder="baseUrl"
                    />
                    <input
                      type="text"
                      value={v.value}
                      onChange={(e) => updateFolderEditorVar(idx, { value: e.target.value })}
                      placeholder="https://api.example.com"
                    />
                    <button type="button" className="ghost danger small" onClick={() => removeFolderVar(v.id)}>
                      הסר
                    </button>
                  </div>
                ))}
                {!folderEditor.vars.length && <p className="muted small">אין משתנים עדיין.</p>}
              </div>
              <div className="actions" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="ghost" onClick={() => setFolderEditor(null)}>
                  ביטול
                </button>
                <button type="button" onClick={saveFolderEditor}>
                  שמור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="pm-main">
        {!activeRequest && <p className="muted">{loading ? 'טוען שירותים...' : 'בחר שירות כדי להתחיל.'}</p>}
        {activeRequest && (
          <div className="pm-workbench">
            <div className="pm-topbar">
              <div className="pm-tab-pill">{activeRequest.name}</div>
              <div className="pm-environment">No Environment</div>
            </div>

            <div className="pm-request-bar">
              <select
                value={activeRequest.method}
                onChange={(e) => updateActive({ method: e.target.value })}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={activeRequest.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://api.example.com/path או https://{{baseUrl}}/path"
              />
              <select
                value={activeRequest.folder || ''}
                onChange={(e) => updateActive({ folder: e.target.value })}
              >
                <option value="">ללא תיקיה</option>
                {folders.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost" onClick={persistActive}>Save</button>
              <button type="button" onClick={sendRequest} disabled={sending}>
                {sending ? 'שולח...' : 'Send'}
              </button>
              <button type="button" className="ghost" onClick={() => handleDuplicateRequest(activeRequest.id)} disabled={sending}>
                שכפל
              </button>
              <button type="button" className="ghost danger" onClick={() => handleDeleteRequest(activeRequest.id)} disabled={sending}>
                מחק
              </button>
            </div>

            <div className="pm-tabs">
            {[
              { key: 'params', label: 'Params' },
              { key: 'auth', label: 'Authorization' },
              { key: 'headers', label: 'Headers' },
              { key: 'body', label: 'Body' },
              { key: 'certs', label: 'Certificates' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`pm-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="pm-panel">{renderTabContent()}</div>

            <div className="pm-response">
              <div className="pm-response-head">
                <div className="pm-response-meta">
                  <span>Response</span>
                  <span className="pm-status">{response.status || '—'}</span>
                  <span className="pm-time">{response.time || ''}</span>
                </div>
              </div>
              {error && <p className="danger-text">{error}</p>}
              {(response.status || response.body) && (
                <pre className="response-body">{response.body}</pre>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default ServicesPage;
