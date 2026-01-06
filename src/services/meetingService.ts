import { supabase } from '../lib/supabase';
import { getOpenAI, getModels } from '../lib/openai';
import type { Database, MeetingType } from '../lib/database.types';
import { getPromptTemplate } from './promptService';
import { canUseCredits, consumeCredit } from './subscriptionService';
import { triggerWebhooks, WEBHOOK_EVENTS } from './webhookService';
import { processTranscript, prepareForEmbedding } from './transcriptProcessor';

type Meeting = Database['public']['Tables']['meetings']['Row'];

const CANON_CONTEXT = `
Metodologia W1 - 4 Pilares:
1) Fluxo de Caixa — organização, orçamento, categorização
2) Proteção Patrimonial — seguros, reservas, blindagem
3) Investimentos — alocação, liquidez, objetivos
4) Expansão Patrimonial — patrimônio, imóveis, negócios

Tipos de Reunião:
- C1 Análise: mapear situação, dores, objetivos
- C2 Proteção: coberturas e riscos
- C3 Investimentos: alocação e estratégia
- C4 Consolidação: revisar tudo
- FUP: checagem de progresso

Sinais de Risco: "caro", "depois vejo", falta de docs, energia baixa, resistência.
`;

export interface MeetingSummary {
  summary: string[];
  decisions: string[];
  suggested_tasks: Array<{
    title: string;
    description: string;
    owner: 'Leonardo' | 'Cliente';
    due_date: string;
  }>;
  risk_signals: string;
}

export async function addMeeting(data: {
  client_id: string;
  type: MeetingType;
  datetime: string;
  transcript_text?: string;
}): Promise<Meeting> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', data.client_id)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) throw new Error('Client not found');
    if (client.user_id !== user.id) {
      throw new Error('Unauthorized: Client does not belong to user');
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({
        client_id: data.client_id,
        type: data.type,
        datetime: data.datetime,
        transcript_text: data.transcript_text || null
      })
      .select()
      .single();

    if (error) throw error;

    await triggerWebhooks(WEBHOOK_EVENTS.MEETING_CREATED, {
      id: meeting.id,
      client_id: meeting.client_id,
      type: meeting.type,
      datetime: meeting.datetime,
      has_transcript: !!meeting.transcript_text,
      created_at: meeting.created_at,
    });

    return meeting;
  } catch (error) {
    console.error('Error in addMeeting:', error);
    throw error;
  }
}

export async function summarizeMeeting(meetingId: string): Promise<MeetingSummary> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const creditCheck = await canUseCredits(user.id);
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || 'Limite de créditos atingido');
    }

    let openai;
    try {
      openai = await getOpenAI();
    } catch (error: any) {
      throw new Error(
        `Não foi possível conectar à OpenAI: ${error.message}. ` +
        `Verifique sua chave de API em Configurações.`
      );
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('id', meetingId)
      .single();

    if (error) throw error;
    if (!meeting.transcript_text) {
      throw new Error('No transcript available for this meeting');
    }

    console.log('[Meeting Summary] Iniciando processamento de transcrição...');
    const processed = processTranscript(meeting.transcript_text);

    console.log('[Meeting Summary] Transcrição processada:', {
      wordCount: processed.metadata.wordCount,
      complexity: processed.metadata.complexity,
      sentiment: processed.metadata.sentiment,
      entitiesFound: {
        monetaryValues: processed.entities.monetary_values.length,
        financialProducts: processed.entities.financial_products.length,
        problems: processed.entities.problems_identified.length,
      }
    });

    const promptTemplate = await getPromptTemplate(user.id, meeting.type);

    const systemPrompt = promptTemplate?.system_prompt || `Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1.`;
    const summaryInstructions = promptTemplate?.summary_instructions || 'Crie um resumo executivo em tópicos com os principais pontos discutidos.';
    const taskInstructions = promptTemplate?.task_generation_instructions || 'Sugira tarefas SMART relevantes para o contexto da reunião.';

    const entitiesContext = processed.entities.financial_products.length > 0
      ? `\n\nPRODUTOS FINANCEIROS MENCIONADOS: ${processed.entities.financial_products.join(', ')}`
      : '';

    const problemsContext = processed.entities.problems_identified.length > 0
      ? `\n\nPROBLEMAS/PREOCUPAÇÕES IDENTIFICADOS:\n${processed.entities.problems_identified.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : '';

    const metadataContext = `\n\nMETADATA DA REUNIÃO:\n- Complexidade: ${processed.metadata.complexity}\n- Sentimento geral: ${processed.metadata.sentiment}\n- Duração estimada: ${processed.metadata.estimatedDuration} minutos`;

    const prompt = `Analise a seguinte TRANSCRIÇÃO DA REUNIÃO e gere um resumo estruturado.

TRANSCRIÇÃO DA REUNIÃO (USE APENAS ESTA INFORMAÇÃO PARA CRIAR O RESUMO):
${processed.cleaned_text}${entitiesContext}${problemsContext}${metadataContext}

---

INSTRUÇÕES:
${summaryInstructions}

${taskInstructions}

Identifique sinais de risco como: linguagem defensiva ("caro", "depois vejo", "talvez"), falta de compromisso, energia baixa.

Responda APENAS em JSON válido com esta estrutura:
{
  "summary": ["bullet 1", "bullet 2", ...],
  "decisions": ["decisão 1", "decisão 2", ...],
  "suggested_tasks": [
    {
      "title": "...",
      "description": "...",
      "owner": "Leonardo" ou "Cliente",
      "due_date": "YYYY-MM-DD"
    }
  ],
  "risk_signals": "texto descrevendo sinais de risco ou 'Nenhum sinal identificado'"
}`;

    console.log('[Meeting Summary] Transcrição recebida:', meeting.transcript_text?.substring(0, 200) + '...');
    console.log('[Meeting Summary] Prompt completo:', prompt.substring(0, 500) + '...');

    const models = await getModels();

    let completion;
    try {
      completion = await openai.chat.completions.create({
      model: models.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
      });
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw new Error(
        `Erro ao processar com OpenAI: ${error.message}. ` +
        `Verifique se sua chave é válida e tem créditos disponíveis.`
      );
    }

    const result = JSON.parse(completion.choices[0].message.content || '{}') as MeetingSummary;

    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        summary: result.summary.join('\n'),
        decisions: result.decisions,
        risk_signals: result.risk_signals
      })
      .eq('id', meetingId);

    if (updateError) throw updateError;

    await consumeCredit(user.id, 'meeting_processed', {
      meeting_id: meetingId,
      meeting_type: meeting.type,
    });

    await triggerWebhooks(WEBHOOK_EVENTS.MEETING_SUMMARY_GENERATED, {
      id: meetingId,
      client_id: meeting.client_id,
      type: meeting.type,
      summary: result.summary,
      decisions: result.decisions,
      risk_signals: result.risk_signals,
      suggested_tasks_count: result.suggested_tasks.length,
      processed_at: new Date().toISOString(),
    });

    return result;
  } catch (error: any) {
    console.error('Error in summarizeMeeting:', error);

    if (error.message?.includes('OpenAI')) {
      throw error;
    }

    throw new Error(
      `Erro ao processar reunião: ${error.message || 'Erro desconhecido'}. ` +
      `Tente novamente ou verifique suas configurações.`
    );
  }
}

export async function getMeetingsByClient(clientId: string): Promise<Meeting[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) throw new Error('Client not found');
    if (client.user_id !== user.id) {
      throw new Error('Unauthorized: Client does not belong to user');
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .order('datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getMeetingsByClient:', error);
    throw error;
  }
}

export async function getAllMeetings(): Promise<Meeting[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        client:clients(*)
      `)
      .order('datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getAllMeetings:', error);
    throw error;
  }
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteMeeting:', error);
    throw error;
  }
}
