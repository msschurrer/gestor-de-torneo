import {matchStart, roundSlots, validateFixture} from './engine';
import type {Match, Tournament} from './types';

export function canChangeTurn(match: Match) {
 return !match.locked && match.status === 'scheduled';
}

export function changeFixtureTurn(tournament: Tournament, matchId: string, target: {slot: number} | {matchId: string}) {
 const {matches, settings} = tournament;
 const match = matches.find(item => item.id === matchId);
 if (!match || !canChangeTurn(match)) throw Error('El partido debe estar programado y desbloqueado.');
 let updated: Match[];
 if ('matchId' in target) {
  const other = matches.find(item => item.id === target.matchId);
  if (!other || !canChangeTurn(other) || other.round !== match.round || other.kind !== match.kind || other.group !== match.group || other.slot === match.slot) {
   throw Error('Elegí otro partido programado y desbloqueado de la misma fecha y zona, en un turno distinto.');
  }
  updated = matches.map(item => {
   const exchange = item.id === match.id ? other : item.id === other.id ? match : null;
   return exchange ? {...item, slot:exchange.slot, pitch:exchange.pitch, startsAt:matchStart(settings,item.round,exchange.slot,matches)} : item;
  });
 } else {
  const {slot} = target;
  if (!Number.isInteger(slot) || slot < 0 || slot >= roundSlots(settings,match.round,matches).length || slot === match.slot) throw Error('Elegí otro turno disponible.');
  if (matches.some(item => item.round === match.round && item.pitch === match.pitch && item.slot === slot)) throw Error('Ese turno ya está ocupado en la cancha.');
  updated = matches.map(item => item.id === match.id ? {...item,slot,startsAt:matchStart(settings,item.round,slot,matches)} : item);
 }
 const openingZones = new Set(matches.filter(item => item.round === match.round && item.slot === 0 && item.group !== null).map(item => item.group));
 if (openingZones.size >= 2 && [...openingZones].some(group=>!updated.some(item=>item.round===match.round&&item.group===group&&item.slot===0))) {
  throw Error('Ese movimiento separa el inicio de las zonas. Intercambiá el turno con otro partido de la misma zona para mantener el inicio simultáneo.');
 }
 const issues = validateFixture(updated,settings);
 if (issues.length) throw Error(issues.join(' '));
 return updated;
}
