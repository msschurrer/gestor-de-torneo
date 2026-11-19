import type {Match} from './types';

export function upcomingRound(matches: Match[]): Match[] {
 const published = matches.filter(match => match.published);
 const pending = published.filter(match => match.status === 'scheduled');
 if (!pending.length) return [];

 const time = (match: Match) => Date.parse(match.startsAt) || Infinity;
 const next = pending.sort((a,b) => time(a)-time(b) || a.round-b.round)[0];

 return published.filter(match => match.round === next.round)
  .sort((a,b) => time(a)-time(b) || a.slot-b.slot || a.pitch.localeCompare(b.pitch));
}
