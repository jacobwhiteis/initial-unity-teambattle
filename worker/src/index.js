import { verifyDiscordRequest, jsonResponse, ephemeralMessage } from './lib/discord.js';
import { handleAddDriver } from './handlers/add-driver.js';
import { handleRemoveDriver } from './handlers/remove-driver.js';
import { handleChangeCar } from './handlers/change-car.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify Discord signature
    const interaction = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
    if (!interaction) {
      return new Response('Invalid signature', { status: 401 });
    }

    // Handle PING (Discord uses this to verify the endpoint)
    if (interaction.type === 1) {
      return jsonResponse({ type: 1 });
    }

    // Handle slash commands
    if (interaction.type === 2) {
      const { name } = interaction.data;
      try {
        if (name === 'add-team-driver') return await handleAddDriver(interaction, env);
        if (name === 'remove-team-driver') return await handleRemoveDriver(interaction, env);
        if (name === 'change-car') return await handleChangeCar(interaction, env);
      } catch (err) {
        console.error(`Error handling /${name}:`, err);
        return ephemeralMessage('Something went wrong. Please try again.');
      }
    }

    return new Response('Unknown interaction', { status: 400 });
  },
};
