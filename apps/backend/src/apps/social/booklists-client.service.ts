import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BooklistSummary = Record<string, unknown>;

@Injectable()
export class BooklistsClientService {
  constructor(private readonly configService: ConfigService) {}

  async listPublicByOwner(ownerId: string) {
    if (!ownerId) {
      return [];
    }

    const baseUrl =
      this.configService.get<string>('BOOKLISTS_SERVICE_URL') ??
      'http://socialbook-booklists:5000';
    const url = new URL(
      `/internal/booklists/public/${encodeURIComponent(ownerId)}`,
      ensureTrailingSlash(baseUrl),
    );

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Booklists service request failed: ${response.status} ${body}`.trim());
    }

    const data = (await response.json()) as { booklists?: BooklistSummary[] };
    return Array.isArray(data.booklists) ? data.booklists : [];
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}
