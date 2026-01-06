import { supabase } from '../lib/supabase';

interface WhatsappConfig {
  apiKey: string;
  instanceId: string;
  defaultNumber?: string;
}

interface SendMessageParams {
  phone: string;
  message: string;
}

async function getWhatsappConfig(): Promise<WhatsappConfig | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', user.id)
      .in('key', ['whatsapp_api_key', 'whatsapp_instance_id', 'whatsapp_default_number']);

    if (error) throw error;

    const config: any = {};
    settings?.forEach(setting => {
      if (setting.key === 'whatsapp_api_key') config.apiKey = setting.value;
      if (setting.key === 'whatsapp_instance_id') config.instanceId = setting.value;
      if (setting.key === 'whatsapp_default_number') config.defaultNumber = setting.value;
    });

    if (!config.apiKey || !config.instanceId) return null;

    return config as WhatsappConfig;
  } catch (error) {
    console.error('Error fetching WhatsApp config:', error);
    throw error;
  }
}

export async function sendWhatsAppMessage({ phone, message }: SendMessageParams): Promise<void> {
  try {
    const config = await getWhatsappConfig();

    if (!config) {
      throw new Error('WhatsApp não configurado. Configure as credenciais da Uazapi nas configurações.');
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const response = await fetch(`https://api.uazapi.com/v1/instance/${config.instanceId}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro ao enviar mensagem: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

export async function sendTasksSummary(clientId: string, phone: string): Promise<void> {
  try {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .neq('status', 'concluida')
      .order('due_date', { ascending: true });

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      throw new Error('Não há tarefas pendentes para enviar');
    }

    const { data: portalAccess } = await supabase
      .from('client_portal_access')
      .select('access_token')
      .eq('client_id', clientId)
      .eq('enabled', true)
      .maybeSingle();

    const portalLink = portalAccess
      ? `\n\n🔗 Acesse seu portal: ${window.location.origin}/portal/${portalAccess.access_token}`
      : '';

    const tasksByStatus = {
      pendente: tasks.filter(t => t.status === 'pendente'),
      em_andamento: tasks.filter(t => t.status === 'em_andamento'),
      em_revisao: tasks.filter(t => t.status === 'em_revisao')
    };

    let message = `📋 *Resumo de Tarefas - ${client.name}*\n\n`;
    message += `Total de tarefas: *${tasks.length}*\n\n`;

    if (tasksByStatus.pendente.length > 0) {
      message += `⏳ *Pendentes (${tasksByStatus.pendente.length})*\n`;
      tasksByStatus.pendente.forEach(task => {
        const dueDate = new Date(task.due_date).toLocaleDateString('pt-BR');
        message += `• ${task.title} - Prazo: ${dueDate}\n`;
      });
      message += '\n';
    }

    if (tasksByStatus.em_andamento.length > 0) {
      message += `🔄 *Em Andamento (${tasksByStatus.em_andamento.length})*\n`;
      tasksByStatus.em_andamento.forEach(task => {
        const dueDate = new Date(task.due_date).toLocaleDateString('pt-BR');
        message += `• ${task.title} - Prazo: ${dueDate}\n`;
      });
      message += '\n';
    }

    if (tasksByStatus.em_revisao.length > 0) {
      message += `👀 *Em Revisão (${tasksByStatus.em_revisao.length})*\n`;
      tasksByStatus.em_revisao.forEach(task => {
        const dueDate = new Date(task.due_date).toLocaleDateString('pt-BR');
        message += `• ${task.title} - Prazo: ${dueDate}\n`;
      });
      message += '\n';
    }

    message += portalLink;
    message += '\n\n_Mensagem automática do Assistente Operacional W1_';

    await sendWhatsAppMessage({ phone, message });
  } catch (error) {
    console.error('Error sending tasks summary:', error);
    throw error;
  }
}

export async function sendMeetingSummary(meetingId: string, phone: string): Promise<void> {
  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*, client:clients(*)')
      .eq('id', meetingId)
      .single();

    if (meetingError) throw meetingError;

    const meetingTypes: Record<string, string> = {
      C1: 'C1 - Análise',
      C2: 'C2 - Proteção',
      C3: 'C3 - Investimentos',
      C4: 'C4 - Consolidação',
      FUP: 'Follow-up'
    };

    let message = `📝 *Resumo da Reunião*\n\n`;
    message += `Cliente: *${(meeting.client as any).name}*\n`;
    message += `Tipo: *${meetingTypes[meeting.type]}*\n`;
    message += `Data: ${new Date(meeting.datetime).toLocaleDateString('pt-BR')}\n\n`;

    if (meeting.summary) {
      message += `*Resumo:*\n${meeting.summary}\n\n`;
    }

    if (meeting.decisions && Array.isArray(meeting.decisions) && meeting.decisions.length > 0) {
      message += `*Decisões:*\n`;
      meeting.decisions.forEach((decision: string) => {
        message += `✓ ${decision}\n`;
      });
      message += '\n';
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('meeting_id', meetingId)
      .neq('status', 'concluida');

    if (tasks && tasks.length > 0) {
      message += `*Próximas Tarefas (${tasks.length}):*\n`;
      tasks.forEach(task => {
        const dueDate = new Date(task.due_date).toLocaleDateString('pt-BR');
        message += `• ${task.title} - Prazo: ${dueDate}\n`;
      });
    }

    message += '\n_Mensagem automática do Assistente Operacional W1_';

    await sendWhatsAppMessage({ phone, message });
  } catch (error) {
    console.error('Error sending meeting summary:', error);
    throw error;
  }
}

export async function saveWhatsAppConfig(config: WhatsappConfig): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const settings = [
      { key: 'whatsapp_api_key', value: config.apiKey },
      { key: 'whatsapp_instance_id', value: config.instanceId },
      { key: 'whatsapp_default_number', value: config.defaultNumber || '' }
    ];

    for (const setting of settings) {
      await supabase
        .from('settings')
        .upsert({
          user_id: user.id,
          key: setting.key,
          value: setting.value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });
    }
  } catch (error) {
    console.error('Error saving WhatsApp config:', error);
    throw error;
  }
}
