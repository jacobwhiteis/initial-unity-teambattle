// Discord slash command definitions
// Used by scripts/register-commands.js and for reference in handlers

export const ADD_TEAM_DRIVER = {
  name: 'add-team-driver',
  description: 'Add a Discord user to a team roster',
  options: [
    {
      name: 'team_tag',
      description: 'Team tag (e.g. MTD, AKG)',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'player',
      description: 'Discord user to add',
      type: 6, // USER
      required: true,
    },
    {
      name: 'display_name',
      description: "Player's display name for the roster",
      type: 3, // STRING
      required: true,
    },
  ],
};

export const REMOVE_TEAM_DRIVER = {
  name: 'remove-team-driver',
  description: 'Remove a Discord user from a team roster',
  options: [
    {
      name: 'team_tag',
      description: 'Team tag (e.g. MTD, AKG)',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'player',
      description: 'Discord user to remove',
      type: 6, // USER
      required: true,
    },
  ],
};

export const ALL_COMMANDS = [ADD_TEAM_DRIVER, REMOVE_TEAM_DRIVER];
