/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2026
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

let uniqueIdCounter = 0

/**
 * Creates a unique id for elements owned by the plugin.
 *
 * This is deliberately independent of `crypto.randomUUID()`. SiYuan embeds
 * Chromium, and older embedded runtimes expose `crypto` without exposing
 * `randomUUID`, which used to prevent the settings dialog from opening.
 */
export function createUniqueDomId(prefix: string): string {
  uniqueIdCounter = (uniqueIdCounter + 1) % Number.MAX_SAFE_INTEGER
  return `${prefix}-${Date.now().toString(36)}-${uniqueIdCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}
