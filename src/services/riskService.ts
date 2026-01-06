import { supabase } from '../lib/supabase';
import { getClient } from './clientService';
import { getMeetingsByClient } from './meetingService';

export interface RiskScoreBreakdown {
  total_score: number;
  classification: 'Baixo' | 'Médio' | 'Alto';
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
}

export async function calculateRiskScore(clientId: string): Promise<RiskScoreBreakdown> {
  try {
    const client = await getClient({ id: clientId });
    if (!client) throw new Error('Client not found');

    const factors: Array<{ factor: string; impact: number; description: string }> = [];
    let totalScore = 0;

    if (client.days_since_last_advance !== null && client.days_since_last_advance > 30) {
      const impact = 25;
      totalScore += impact;
      factors.push({
        factor: 'Sem avanço há mais de 30 dias',
        impact,
        description: `${client.days_since_last_advance} dias sem avanço real`
      });
    }

    if (client.overdue_client_tasks.length > 0) {
      const impact = 20;
      totalScore += impact;
      factors.push({
        factor: 'Tarefas do cliente vencidas',
        impact,
        description: `${client.overdue_client_tasks.length} tarefa(s) vencida(s)`
      });
    }

    const meetings = await getMeetingsByClient(clientId);
    const recentMeetings = meetings.slice(0, 2);

    if (recentMeetings.length >= 2) {
      let defensiveSignalsCount = 0;

      for (const meeting of recentMeetings) {
        if (meeting.risk_signals &&
            meeting.risk_signals.toLowerCase() !== 'nenhum sinal identificado' &&
            meeting.risk_signals.trim() !== '') {
          defensiveSignalsCount++;
        }
      }

      if (defensiveSignalsCount >= 2) {
        const impact = 15;
        totalScore += impact;
        factors.push({
          factor: 'Linguagem defensiva em 2 reuniões seguidas',
          impact,
          description: 'Sinais de resistência detectados'
        });
      }
    }

    if (client.completed_tasks_last_week >= 2) {
      const impact = -15;
      totalScore += impact;
      factors.push({
        factor: 'Tarefas concluídas na última semana',
        impact,
        description: `${client.completed_tasks_last_week} tarefa(s) concluída(s)`
      });
    }

    const { data: upcomingMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .gte('datetime', new Date().toISOString())
      .lte('datetime', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    if (upcomingMeetings && upcomingMeetings.length > 0) {
      const impact = -10;
      totalScore += impact;
      factors.push({
        factor: 'Próxima reunião agendada',
        impact,
        description: 'Reunião confirmada nos próximos 7 dias'
      });
    }

    totalScore = Math.max(0, Math.min(100, totalScore));

    let classification: 'Baixo' | 'Médio' | 'Alto';
    if (totalScore <= 39) {
      classification = 'Baixo';
    } else if (totalScore <= 69) {
      classification = 'Médio';
    } else {
      classification = 'Alto';
    }

    await supabase
      .from('clients')
      .update({ risk_score: totalScore })
      .eq('id', clientId);

    return {
      total_score: totalScore,
      classification,
      factors
    };
  } catch (error) {
    console.error('Error in calculateRiskScore:', error);
    throw error;
  }
}
