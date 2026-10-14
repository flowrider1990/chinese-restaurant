import * as migration_20261013_195310_initial from './20261013_195310_initial';
import * as migration_20261014_085535_menu_details from './20261014_085535_menu_details';
import * as migration_20261014_093915_site_name_native from './20261014_093915_site_name_native';
import * as migration_20261014_095128_payment_methods from './20261014_095128_payment_methods';
import * as migration_20261014_101615_site_cuisine from './20261014_101615_site_cuisine';
import * as migration_20261014_115138_category_image from './20261014_115138_category_image';
import * as migration_20261014_120130_about_image from './20261014_120130_about_image';
import * as migration_20261014_130914_reservations from './20261014_130914_reservations';
import * as migration_20261014_172131_vouchers from './20261014_172131_vouchers';

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
    name: '20261014_095128_payment_methods',
  },
  {
    up: migration_20261014_101615_site_cuisine.up,
    down: migration_20261014_101615_site_cuisine.down,
    name: '20261014_101615_site_cuisine',
  },
  {
    up: migration_20261014_115138_category_image.up,
    down: migration_20261014_115138_category_image.down,
    name: '20261014_115138_category_image',
  },
  {
    up: migration_20261014_120130_about_image.up,
    down: migration_20261014_120130_about_image.down,
    name: '20261014_120130_about_image',
  },
  {
    up: migration_20261014_130914_reservations.up,
    down: migration_20261014_130914_reservations.down,
    name: '20261014_130914_reservations',
  },
  {
    up: migration_20261014_172131_vouchers.up,
    down: migration_20261014_172131_vouchers.down,
    name: '20261014_172131_vouchers'
  },
];
