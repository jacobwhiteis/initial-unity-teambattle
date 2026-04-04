import nacl from 'tweetnacl';

/**
 * Verify a Discord interaction request signature.
 * Returns the parsed interaction body if valid, null if invalid.
 */
export async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || !timestamp) return null;

  const body = await request.text();
  const isValid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8(signature),
    hexToUint8(publicKey)
  );

  return isValid ? JSON.parse(body) : null;
}

function hexToUint8(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Build a JSON interaction response. */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Ephemeral message response (only visible to the invoker). */
export function ephemeralMessage(content) {
  return jsonResponse({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: { content, flags: 64 },
  });
}

/** Get an option value from an interaction by name. */
export function getOption(interaction, name) {
  const opt = interaction.data.options?.find(o => o.name === name);
  return opt?.value ?? null;
}
