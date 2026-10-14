import * as migration_20261013_195310_initial from './20261013_195310_initial';
import * as migration_20261014_085535_menu_details from './20261014_085535_menu_details';
import * as migration_20261014_093915_site_name_native from './20261014_093915_site_name_native';
import * as migration_20261014_095128_payment_methods from './20261014_095128_payment_methods';

export const migrations = [
  {
    up: migration_20261013_195310_initial.up,
    down: migration_20261013_195310_initial.down,
    name: '20261013_195310_initial',
  },
  {
    up: migration_20261014_085535_menu_details.up,
    down: migration_20261014_085535_menu_details.down,
    name: '20261014_085535_menu_details',
  },
  {
    up: migration_20261014_093915_site_name_native.up,
    down: migration_20261014_093915_site_name_native.down,
    name: '20261014_093915_site_name_native',
  },
  {
    up: migration_20261014_095128_payment_methods.up,
    down: migration_20261014_095128_payment_methods.down,
    name: '20261014_095128_payment_methods'
  },
];
