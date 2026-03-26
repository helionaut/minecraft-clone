import { describe, expect, it } from 'vitest';

import type { SandboxStatus } from '../../src/rendering/scene.ts';
import {
  buildRendererDiagnostics,
  shouldPublishSandboxStatus,
} from '../../src/rendering/sandboxStatus.ts';

function sampleStatus(overrides: Partial<SandboxStatus> = {}): SandboxStatus {
  return {
    locked: false,
    activeItem: 'grass',
    selectedBlock: 'grass',
    coords: 'X 0.0 Y 5.0 Z 0.0',
    target: 'Aim at terrain',
    prompt: 'Click the viewport to capture the mouse and enter the world.',
    touchDevice: false,
    selectedTool: 'hand',
    stations: 'none nearby',
    renderer: 'WebGL 2 | hardware accelerated',
    inventory: [{ type: 'oak-log', count: 3 }],
    recipes: [{
      id: 'oak-planks',
      label: 'oak planks',
      station: null,
      available: true,
      inputs: [{ type: 'oak-log', count: 1 }],
      outputs: [{ type: 'oak-planks', count: 4 }],
    }],
    placeableCounts: {
      grass: 0,
      dirt: 0,
      stone: 0,
      cobblestone: 0,
      sand: 0,
      'oak-log': 3,
      'oak-planks': 0,
      'crafting-table': 0,
      furnace: 0,
    },
    ...overrides,
  };
}

describe('shouldPublishSandboxStatus', () => {
  it('suppresses identical status payloads', () => {
    const previous = sampleStatus();
    const next = sampleStatus();

    expect(shouldPublishSandboxStatus(null, previous)).toBe(true);
    expect(shouldPublishSandboxStatus(previous, next)).toBe(false);
  });

  it('publishes meaningful nested changes such as recipe availability', () => {
    const previous = sampleStatus();
    const next = sampleStatus({
      recipes: [{
        id: 'oak-planks',
        label: 'oak planks',
        station: null,
        available: false,
        inputs: [{ type: 'oak-log', count: 1 }],
        outputs: [{ type: 'oak-planks', count: 4 }],
      }],
    });

    expect(shouldPublishSandboxStatus(previous, next)).toBe(true);
  });
});

describe('buildRendererDiagnostics', () => {
  it('marks SwiftShader as a software fallback and includes the raw renderer', () => {
    const diagnostics = buildRendererDiagnostics({
      version: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
      vendor: 'Google Inc. (Google)',
      renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    });

    expect(diagnostics.mode).toBe('software-fallback');
    expect(diagnostics.summary).toContain('software fallback');
    expect(diagnostics.summary).toContain('SwiftShader');
  });

  it('marks discrete GPU renderers as hardware accelerated', () => {
    const diagnostics = buildRendererDiagnostics({
      version: 'WebGL 2.0',
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070, OpenGL 4.6)',
    });

    expect(diagnostics.mode).toBe('hardware-accelerated');
    expect(diagnostics.summary).toContain('hardware accelerated');
  });
});
