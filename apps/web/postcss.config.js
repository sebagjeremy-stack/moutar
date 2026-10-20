import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

const here = dirname(fileURLToPath(import.meta.url));
export default { plugins: [tailwindcss(resolve(here, 'tailwind.config.cjs')), autoprefixer()] };
