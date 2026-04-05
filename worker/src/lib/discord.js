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

/** Resolve a role from an interaction option. Returns { id, name, ... } or null. */
export function getResolvedRole(interaction, optionName) {
  const roleId = getOption(interaction, optionName);
  if (!roleId) return null;
  return {
    id: roleId,
    ...interaction.data.resolved?.roles?.[roleId],
  };
}

/** Add a Discord role to a guild member. Returns true on success. */
export async function addRoleToMember(env, guildId, userId, roleId) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    }
  );
  if (res.status !== 204) {
    console.error(`Discord role add failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204;
}

/** Remove a Discord role from a guild member. Returns true on success. */
export async function removeRoleFromMember(env, guildId, userId, roleId) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    }
  );
  if (res.status !== 204) {
    console.error(`Discord role remove failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204;
}
