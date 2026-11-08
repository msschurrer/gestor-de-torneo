import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tournamentSchema} from '../lib/validation';
import {demoTournament} from '../lib/demo';
import {tournamentIdentityError,formatValidationError} from '../lib/form-errors';
test('nombre y enlace incompletos muestran instrucciones en vez de errores técnicos',()=>{const result=tournamentSchema.safeParse({...demoTournament(),name:'',slug:''});assert.equal(result.success,false);if(!result.success){const message=formatValidationError(result.error)!;assert.ok(message.includes('nombre del torneo'));assert.ok(message.includes('enlace público'));assert.equal(/invalid_format|too_small|\[\{|regex|pattern/.test(message),false);}assert.ok(tournamentIdentityError({name:'ab',slug:''}).includes('Configuración'));assert.equal(tournamentIdentityError({name:'Copa Verano',slug:'copa-verano'}),'');});
test('validaciones deportivas mantienen la explicación del problema',()=>{const t=demoTournament();t.matches[0].events[0].teamId='00000000-0000-4000-a000-999999999999';const result=tournamentSchema.safeParse(t);if(result.success)throw Error('Se esperaba error');assert.ok(formatValidationError(result.error)?.includes('Evento fuera del plantel'));assert.equal(formatValidationError(Error('Red')),undefined);});
