// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { BASH, STALL_MS, wslStall } from './wsl-bash';

// DW-135: what a stalled `bash.exe` returned on 2026-10-18 (29116 ms to 30216 ms): exit 1, an empty stderr,
// and its own UTF-16LE error on stdout, which reads NUL-interleaved as UTF-8.
const utf16 = (text: string): string => Buffer.from(text, 'utf16le').toString('utf8');
const stalled = { status: 1, stdout: utf16('Catastrophic failure \r\nError code: Bash/Service/E_UNEXPECTED\r\n'), stderr: '' };

describe('a WSL stall is named as WSL (DW-135)', () => {
  it("names a failed spawn of WSL bash that took the stall time and wrote WSL's own error", () => {
    expect(wslStall(stalled, 30008, true)).toBe(
      `WSL did not answer: ${BASH} ` +
        'exited 1 after 30008 ms and wrote its own error, not the script\'s: "Catastrophic failure Error code: Bash/Service/E_UNEXPECTED". ' +
        'This is the host stall of DW-135, not the case under test: re-run the file before debugging.'
    );
  });

  it('names a failed, silent spawn of WSL bash that took the stall time', () => {
    expect(wslStall({ status: null, stdout: null, stderr: '\n' }, STALL_MS, true)).toMatch(
      /^WSL did not answer: .* exited null after 20000 ms with no output\. .*DW-135/
    );
  });

  it('leaves every other result to the case that reads it', () => {
    expect(wslStall(stalled, 30008, false)).toBeNull();
    expect(wslStall(stalled, STALL_MS - 1, true)).toBeNull();
    expect(wslStall({ ...stalled, status: 0 }, 30008, true)).toBeNull();
    expect(wslStall({ ...stalled, stdout: 'a script that failed slowly\n' }, 30008, true)).toBeNull();
    expect(wslStall({ status: 1, stdout: '', stderr: 'refused' }, 30008, true)).toBeNull();
  });
});
