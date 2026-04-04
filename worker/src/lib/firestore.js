const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Create a Firestore REST API client for a given project.
 */
export function createFirestoreClient(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const basePath = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents`;

  async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    const now = Math.floor(Date.now() / 1000);
    const jwt = await buildJWT(
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      env.GOOGLE_PRIVATE_KEY,
      now
    );

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
    return cachedToken;
  }

  async function authHeaders() {
    const token = await getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  return {
    /** Get a single document. Returns null if not found. */
    async getDocument(collectionId, documentId) {
      const res = await fetch(`${basePath}/${collectionId}/${documentId}`, {
        headers: await authHeaders(),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Firestore GET failed: ${await res.text()}`);
      return decodeDocument(await res.json());
    },

    /** List all documents in a collection. */
    async listDocuments(collectionId) {
      const docs = [];
      let pageToken = '';
      do {
        const url = `${basePath}/${collectionId}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url, { headers: await authHeaders() });
        if (!res.ok) throw new Error(`Firestore LIST failed: ${await res.text()}`);
        const data = await res.json();
        if (data.documents) {
          docs.push(...data.documents.map(decodeDocument));
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return docs;
    },

    /** Run a structured query with a single field filter. */
    async queryCollection(collectionId, field, op, value) {
      const res = await fetch(`${basePath}:runQuery`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: field },
                op,
                value: encodeValue(value),
              },
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`Firestore QUERY failed: ${await res.text()}`);
      const results = await res.json();
      return results
        .filter(r => r.document)
        .map(r => decodeDocument(r.document));
    },

    /** Atomic batch write (update multiple documents). */
    async batchWrite(writes) {
      const res = await fetch(
        `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:commit`,
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ writes }),
        }
      );
      if (!res.ok) throw new Error(`Firestore BATCH failed: ${await res.text()}`);
      return res.json();
    },

    /** Build an update write for batchWrite. */
    buildUpdate(collectionId, documentId, fields) {
      return {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/${collectionId}/${documentId}`,
          fields: encodeFields(fields),
        },
        updateMask: { fieldPaths: Object.keys(fields) },
      };
    },

    projectId,
    basePath,
  };
}

// --- Firestore value encoding/decoding ---

function encodeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return val.length === 0
      ? { arrayValue: {} }
      : { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: encodeFields(val) } };
  }
  return { stringValue: String(val) };
}

function encodeFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = encodeValue(val);
  }
  return fields;
}

function decodeValue(val) {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(decodeValue);
  }
  if ('mapValue' in val) {
    return decodeFields(val.mapValue.fields || {});
  }
  return null;
}

function decodeFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = decodeValue(val);
  }
  return obj;
}

function decodeDocument(doc) {
  const name = doc.name;
  const parts = name.split('/');
  const id = parts[parts.length - 1];
  return { id, ...decodeFields(doc.fields || {}) };
}

// --- JWT for Google service account ---

async function buildJWT(email, privateKeyPem, now) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(sig)}`;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64url(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
