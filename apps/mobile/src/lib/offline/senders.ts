// Cómo se envía cada tipo de registro de la bandeja de salida y qué datos se
// refrescan después. Se importa una vez desde app/_layout.tsx, para que la
// bandeja pueda vaciarse al abrir la app aunque no se haya abierto la pantalla
// de ese tipo.

import { Alert } from 'react-native';

import { sendMeasurement, type PendingMeasurement } from '@/features/body/use-body';
import { sendActivity, type ActivityInput, type LogResult } from '@/features/sports/use-activities';
import { sendSession, type PendingSession } from '@/features/strength/use-strength';
import { sendWodResult, type PendingWod } from '@/features/wod/use-wod';

import { registerSender } from './outbox';

registerSender('activity', {
  send: (i) => sendActivity(i.userId, i.payload as ActivityInput),
  invalidate: (i) => [['activities', i.memberId], ['challenges'], ['feed']],
  after: (_i, result) => {
    const { completed } = result as LogResult;
    if (completed.length) {
      Alert.alert('¡Reto cumplido! 🏆', `Se envió tu actividad pendiente:\n${completed.map((t) => `• ${t}`).join('\n')}`);
    }
  },
});

registerSender('wod', {
  send: (i) => sendWodResult(i.memberId, i.payload as PendingWod),
  invalidate: (i) => {
    const { date } = i.payload as PendingWod;
    return [['wod-result', i.memberId, date], ['wod-board', date], ['wod-history', i.memberId]];
  },
});

registerSender('strength', {
  send: (i) => sendSession(i.memberId, i.userId, i.payload as PendingSession),
  invalidate: (i) => [['strength', i.memberId]],
});

registerSender('body', {
  send: (i) => sendMeasurement(i.memberId, i.userId, i.payload as PendingMeasurement),
  invalidate: (i) => [['body', i.memberId], ['latest-weight', i.memberId]],
});
