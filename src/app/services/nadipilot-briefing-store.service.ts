import { Injectable } from '@angular/core';
import { NadiPilotBriefingDTO } from './ai-integration.service';

/** A briefing the dashboard already received, and when. */
export interface StoredNadiPilotBriefing {
  key: string;
  /** Undefined when the server had nothing to report: the rule-based summary stands. */
  briefing: NadiPilotBriefingDTO | undefined;
  fetchedAt: number;
}

/**
 * The last NadiPilot briefing the dashboard received, kept for the browser session.
 *
 * The dashboard is rebuilt each time it is opened, and used to fetch the briefing again, with its
 * "NadiPilot is thinking" animation, on every return. It now shows the stored briefing at once and asks
 * the server again only when the stored one is older than {@link FRESH_MS} (the server keeps its own
 * five-minute cache as well), or when the user presses refresh.
 *
 * Keyed by user, organisation and language, so a briefing never outlives a change of any of them. The
 * store is in memory only: signing out and switching organisation reload the page, which empties it.
 */
@Injectable({ providedIn: 'root' })
export class NadiPilotBriefingStore {
  static readonly FRESH_MS = 5 * 60 * 1000;

  private entry: StoredNadiPilotBriefing | null = null;

  get(key: string): StoredNadiPilotBriefing | null {
    return this.entry && this.entry.key === key ? this.entry : null;
  }

  set(key: string, briefing: NadiPilotBriefingDTO | undefined): void {
    this.entry = { key, briefing, fetchedAt: Date.now() };
  }

  isFresh(stored: StoredNadiPilotBriefing): boolean {
    return Date.now() - stored.fetchedAt < NadiPilotBriefingStore.FRESH_MS;
  }

  clear(): void {
    this.entry = null;
  }
}
