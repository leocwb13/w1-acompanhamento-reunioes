import { getOpenAI } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { canUseCredits, consumeCredit } from './subscriptionService';
import type { Client } from './clientService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatContext {
  client: Client | null;
  recentMeetings: any[];
  pendingTasks: any[];
}

export async function sendChatMessage(
  userId: string,
  clientId: string | null,
  message: string,
  conversationHistory: ChatMessage[]
): Promise<{ response: string; context: any }> {
  const creditCheck = await canUseCredits(userId);
  if (!creditCheck.allowed) {
    throw new Error(creditCheck.reason || 'Sem créditos disponíveis');
  }

  let context: ChatContext = {
    client: null,
    recentMeetings: [],
    pendingTasks: [],
  };

  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .order('datetime', { ascending: false })
      .limit(5);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'pendente')
      .order('due_date', { ascending: true })
      .limit(10);

    context = {
      client: client || null,
      recentMeetings: meetings || [],
      pendingTasks: tasks || [],
    };
  }

  const openai = await getOpenAI();

  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user' as const, content: message }
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  const assistantResponse = completion.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';

  await consumeCredit(userId, 'chat_message', {
    clientId,
    messageLength: message.length,
    responseLength: assistantResponse.length,
  });

  if (clientId) {
    await supabase.from('conversation_history').insert({
      client_id: clientId,
      user_message: message,
      assistant_response: assistantResponse,
      sources_cited: context,
    });
  }

  return {
    response: assistantResponse,
    context,
  };
}

function buildSystemPrompt(context: ChatContext): string {
  let prompt = `Você é o Assistente Operacional W1, especializado em ajudar consultores a gerenciar seus clientes de forma eficaz.

Suas responsabilidades incluem:
- Responder perguntas sobre clientes específicos
- Analisar status de projetos e tarefas
- Identificar riscos e alertas
- Sugerir próximos passos e ações
- Gerar relatórios e insights

Seja direto, prático e use dados concretos quando disponível.`;

  if (context.client) {
    prompt += `\n\n## Cliente Atual
Nome: ${context.client.name}
Status: ${context.client.status}
Faturamento: ${context.client.revenue_bracket || 'Não informado'}
Risk Score: ${context.client.risk_score}
Última Atividade: ${context.client.last_activity_date ? new Date(context.client.last_activity_date).toLocaleDateString('pt-BR') : 'Nenhuma'}`;
  }

  if (context.recentMeetings.length > 0) {
    prompt += `\n\n## Reuniões Recentes (${context.recentMeetings.length})`;
    context.recentMeetings.forEach((meeting, index) => {
      prompt += `\n${index + 1}. ${meeting.type} - ${new Date(meeting.datetime).toLocaleDateString('pt-BR')}`;
      if (meeting.summary) {
        prompt += `\n   Resumo: ${meeting.summary.substring(0, 150)}...`;
      }
    });
  }

  if (context.pendingTasks.length > 0) {
    prompt += `\n\n## Tarefas Pendentes (${context.pendingTasks.length})`;
    context.pendingTasks.forEach((task, index) => {
      prompt += `\n${index + 1}. ${task.title}`;
      prompt += `\n   Responsável: ${task.owner}`;
      prompt += `\n   Vencimento: ${new Date(task.due_date).toLocaleDateString('pt-BR')}`;
    });
  }

  return prompt;
}

export async function getConversationHistory(
  clientId: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('conversation_history')
    .select('id, user_message, assistant_response, timestamp')
    .eq('client_id', clientId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }

  const messages: ChatMessage[] = [];
  data.forEach(record => {
    messages.push({
      id: `${record.id}-user`,
      role: 'user',
      content: record.user_message,
      timestamp: record.timestamp,
    });
    messages.push({
      id: `${record.id}-assistant`,
      role: 'assistant',
      content: record.assistant_response,
      timestamp: record.timestamp,
    });
  });

  return messages.reverse();
}
