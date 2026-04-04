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
    {
      name: 'car',
      description: "Player's car (e.g. AE86, FD3S, BNR32)",
      type: 3, // STRING
      required: true,
      choices: [
        { name: 'AE86', value: 'AE86' },
        { name: 'FD3S', value: 'FD3S' },
        { name: 'RPS13', value: 'RPS13' },
        { name: 'BNR32', value: 'BNR32' },
        { name: 'CE9A', value: 'CE9A' },
        { name: 'EG6', value: 'EG6' },
        { name: 'SW20', value: 'SW20' },
        { name: 'FC3S', value: 'FC3S' },
        { name: 'AP1', value: 'AP1' },
        { name: 'NA6CE', value: 'NA6CE' },
        { name: 'NA1', value: 'NA1' },
        { name: 'GC8F', value: 'GC8F' },
        { name: 'DC2', value: 'DC2' },
        { name: 'JZA80', value: 'JZA80' },
        { name: 'S14', value: 'S14' },
        { name: 'ZZW30', value: 'ZZW30' },
        { name: 'EA11R', value: 'EA11R' },
        { name: 'CN9A', value: 'CN9A' },
      ],
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

export const CHANGE_CAR = {
  name: 'change-car',
  description: "Change a driver's car",
  options: [
    {
      name: 'player',
      description: 'Discord user to update',
      type: 6, // USER
      required: true,
    },
    {
      name: 'car',
      description: 'New car',
      type: 3, // STRING
      required: true,
      choices: [
        { name: 'AE86', value: 'AE86' },
        { name: 'FD3S', value: 'FD3S' },
        { name: 'RPS13', value: 'RPS13' },
        { name: 'BNR32', value: 'BNR32' },
        { name: 'CE9A', value: 'CE9A' },
        { name: 'EG6', value: 'EG6' },
        { name: 'SW20', value: 'SW20' },
        { name: 'FC3S', value: 'FC3S' },
        { name: 'AP1', value: 'AP1' },
        { name: 'NA6CE', value: 'NA6CE' },
        { name: 'NA1', value: 'NA1' },
        { name: 'GC8F', value: 'GC8F' },
        { name: 'DC2', value: 'DC2' },
        { name: 'JZA80', value: 'JZA80' },
        { name: 'S14', value: 'S14' },
        { name: 'ZZW30', value: 'ZZW30' },
        { name: 'EA11R', value: 'EA11R' },
        { name: 'CN9A', value: 'CN9A' },
      ],
    },
  ],
};

export const ALL_COMMANDS = [ADD_TEAM_DRIVER, REMOVE_TEAM_DRIVER, CHANGE_CAR];
