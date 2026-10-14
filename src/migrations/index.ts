import * as migration_20261013_195310_initial from './20261013_195310_initial';
import * as migration_20261014_085535_menu_details from './20261014_085535_menu_details';

export const migrations = [
  {
    up: migration_20261013_195310_initial.up,
    down: migration_20261013_195310_initial.down,
    name: '20261013_195310_initial',
  },
  {
    up: migration_20261014_085535_menu_details.up,
    down: migration_20261014_085535_menu_details.down,
    name: '20261014_085535_menu_details'
  },
];
