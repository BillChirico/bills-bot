import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, '..', 'src', 'commands');

const commandFiles = readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

describe('command files', () => {
  it('should have at least one command', () => {
    expect(commandFiles.length).toBeGreaterThan(0);
  });

  for (const file of commandFiles) {
    describe(file, () => {
      let mod;

      it('should export data and execute', async () => {
        mod = await import(join(commandsDir, file));
        expect(mod.data).toBeDefined();
        expect(mod.data.name).toBeTruthy();
        expect(typeof mod.execute).toBe('function');
      });

      it('should have a description on data', async () => {
        mod = mod || (await import(join(commandsDir, file)));
        // SlashCommandBuilder stores description in .description
        expect(mod.data.description).toBeTruthy();
      });
    });
  }
});
