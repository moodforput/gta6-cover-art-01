// Neon Coast Cover Studio — the entry program (Node 22, standard library only).
// It hands the static web app in: app/ and screenshots/ are copied from this
// repository into the output directory, and dossier.json is written with the
// make.fun library vendored under vendor/. The program runs twice in the
// grader and both runs must write identical bytes, so it does nothing that
// depends on the clock, randomness or the environment beyond the output dir.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the app locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory holding this file; the grader runs it
// from a read-only copy of the repository, so everything is read from here.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps (kit reference/gate.json): the text cap shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse anyway — more than
// four screenshots or one over 256 KiB; app/ over 993 entries or 48 MiB in
// all, or a path under app/ over 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// A one-line summary of what was handed in, for the build log. It reads the
// output tree back (no timestamps, no sizes that could vary) so the program's
// own output stays identical between its two runs.
import { readdirSync, statSync } from 'node:fs';

function countEntries(dir) {
  let files = 0;
  let dirs = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      dirs += 1;
      const sub = countEntries(path);
      files += sub.files;
      dirs += sub.dirs;
    } else {
      files += 1;
    }
  }
  return { files, dirs };
}

const handedIn = countEntries(outputDir);
console.log(
  `handed in ${handedIn.files} files in ${handedIn.dirs} directories to ${outputDir}`,
);
