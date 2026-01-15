import https from 'https';
import { Location, TravelCalculator, createSimpleTravelCalculator } from './availability';

export interface TravelProvider {
  travel(from: Location, to: Location, departure: Date): Promise<{ timeMinutes: number; distanceKm: number }>;
}

function parseDistanceMatrixResponse(json: unknown) {
  if (!json || typeof json !== 'object' || !('rows' in json) || !Array.isArray((json as any).rows)) {
    throw new Error('Unexpected distance matrix response');
  }

  const row = (json as any).rows[0];
  const element = row?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('Distance matrix element missing');
  }

  const distanceMeters = element.distance?.value;
  const durationSeconds = element.duration_in_traffic?.value ?? element.duration?.value;

  if (distanceMeters === undefined || durationSeconds === undefined) {
    throw new Error('Distance matrix element missing distance or duration');
  }

  return {
    distanceKm: distanceMeters / 1000,
    timeMinutes: durationSeconds / 60,
  };
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Failed to fetch travel data (${res.statusCode})`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

export class GoogleMapsTravelProvider implements TravelProvider {
  constructor(private apiKey: string) {}

  async travel(from: Location, to: Location, departure: Date) {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${from.latitude},${from.longitude}`);
    url.searchParams.set('destinations', `${to.latitude},${to.longitude}`);
    url.searchParams.set('departure_time', Math.floor(departure.getTime() / 1000).toString());
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', this.apiKey);

    const json = await fetchJson(url.toString());
    return parseDistanceMatrixResponse(json);
  }
}

export function buildTravelCalculator(provider?: TravelProvider): TravelCalculator {
  const fallback = createSimpleTravelCalculator();

  if (!provider) return fallback;

  return {
    distanceBetween: fallback.distanceBetween,
    travel: async (from, to, departure) => {
      try {
        return await provider.travel(from, to, departure);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Travel provider failed, falling back to simple calculator', error);
        return fallback.travel(from, to, departure);
      }
    },
  };
}

export function buildGoogleMapsTravelCalculatorFromEnv(): TravelCalculator {
  const apiKey = process.env.MAPS_API_KEY;
  if (!apiKey) {
    return createSimpleTravelCalculator();
  }

  const provider = new GoogleMapsTravelProvider(apiKey);
  return buildTravelCalculator(provider);
}
