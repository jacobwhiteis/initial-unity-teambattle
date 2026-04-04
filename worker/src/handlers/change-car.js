import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

const VALID_CARS = [
  'AE86','FD3S','RPS13','BNR32','CE9A','EG6','SW20','FC3S',
  'AP1','NA6CE','NA1','GC8F','DC2','JZA80','S14','ZZW30','EA11R','CN9A'
];

export async function handleChangeCar(interaction, env) {
  const playerId = getOption(interaction, 'player');
  const car = (getOption(interaction, 'car') || '').toUpperCase();
  const invokerId = interaction.member.user.id;

  if (!car || !VALID_CARS.includes(car)) {
    return ephemeralMessage(`Invalid car. Valid options: ${VALID_CARS.join(', ')}`);
  }

  const db = createFirestoreClient(env);

  // 1. Check staff permission
  const staffResults = await db.queryCollection('staff', 'discordId', 'EQUAL', invokerId);
  if (staffResults.length === 0) {
    return ephemeralMessage('You do not have staff permissions to use this command.');
  }

  // 2. Find which team this player is on via drivers collection
  const driverDoc = await db.getDocument('drivers', playerId);
  if (!driverDoc) {
    return ephemeralMessage(`<@${playerId}> is not on any team's roster.`);
  }

  const teamDoc = await db.getDocument('teams', driverDoc.teamId);
  if (!teamDoc) {
    return ephemeralMessage(`Could not find team data for **${driverDoc.teamName}**.`);
  }

  const roster = teamDoc.roster || [];
  const driverIdx = roster.findIndex(d => d.discordId === playerId);
  if (driverIdx === -1) {
    return ephemeralMessage(`<@${playerId}> is not on any team's roster.`);
  }

  const foundDriver = roster[driverIdx];

  // 3. Update the car
  const newRoster = [...roster];
  newRoster[driverIdx] = { ...newRoster[driverIdx], car };

  await db.batchWrite([
    db.buildUpdate('teams', teamDoc.id, { roster: newRoster }),
    db.buildUpdate('standings', teamDoc.id, { roster: newRoster }),
    db.buildUpdate('drivers', playerId, { car }),
  ]);

  return ephemeralMessage(
    `Changed **${foundDriver.name}**'s car to **${car}** on **[${teamDoc.tag}] ${teamDoc.name}**.`
  );
}
