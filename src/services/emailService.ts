import { supabase } from '../lib/supabase';
import { getClient } from './clientService';
import { getMeetingsByClient } from './meetingService';
import { getTasksByClient } from './taskService';
import { triggerWebhooks, WEBHOOK_EVENTS } from './webhookService';

export interface EmailDraft {
  subject: string;
  html_body: string;
}

export async function draftEmail(params: {
  client_id?: string;
  meeting_id?: string;
}): Promise<EmailDraft> {
  try {
    let clientId: string;
    let meetingData = null;

    if (params.meeting_id) {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', params.meeting_id)
        .single();

      if (error) throw error;
      clientId = meeting.client_id;
      meetingData = meeting;
    } else if (params.client_id) {
      clientId = params.client_id;
      const meetings = await getMeetingsByClient(clientId);
      meetingData = meetings[0] || null;
    } else {
      throw new Error('Either client_id or meeting_id must be provided');
    }

    const client = await getClient({ id: clientId });
    if (!client) throw new Error('Client not found');

    const tasks = await getTasksByClient(clientId);
    const pendingTasks = tasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento');

    const today = new Date();
    const responseDeadline = new Date(today);
    responseDeadline.setDate(responseDeadline.getDate() + 3);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let summaryBullets = '';
    let decisionsChecklist = '';

    if (meetingData && meetingData.summary) {
      const summaryLines = meetingData.summary.split('\n').filter((l: string) => l.trim());
      summaryBullets = summaryLines.map((line: string) => `<li>${line}</li>`).join('');
    } else {
      summaryBullets = '<li>Revisão da situação financeira atual</li><li>Discussão sobre objetivos de curto e médio prazo</li>';
    }

    if (meetingData && meetingData.decisions && Array.isArray(meetingData.decisions)) {
      decisionsChecklist = meetingData.decisions
        .map((d: string) => `<li style="margin-bottom: 8px;"><input type="checkbox" disabled> ${d}</li>`)
        .join('');
    }

    let tasksTable = '';
    if (pendingTasks.length > 0) {
      const taskRows = pendingTasks
        .slice(0, 5)
        .map(task => {
          const dueDate = new Date(task.due_date).toLocaleDateString('pt-BR');
          const owner = task.owner;
          return `
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${task.title}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${owner}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${dueDate}</td>
            </tr>
          `;
        })
        .join('');

      tasksTable = `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Tarefa</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Responsável</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Prazo</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      `;
    }

    const subject = `W1 | Resumo e próximos passos — ${client.name} (${formatDate(today)})`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #2c3e50; margin-top: 0;">Olá, ${client.name.split(' ')[0]}!</h2>

    <p>Seguem os pontos principais da nossa conversa e os próximos passos para continuarmos avançando juntos.</p>

    <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Resumo</h3>
    <ul style="padding-left: 20px;">
      ${summaryBullets}
    </ul>

    ${decisionsChecklist ? `
    <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Decisões</h3>
    <ul style="list-style-type: none; padding-left: 20px;">
      ${decisionsChecklist}
    </ul>
    ` : ''}

    ${tasksTable ? `
    <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Próximos Passos</h3>
    ${tasksTable}
    ` : ''}

    <div style="background-color: #e8f4f8; padding: 16px; border-radius: 8px; margin-top: 24px;">
      <p style="margin: 0; font-weight: bold;">📅 Ação necessária</p>
      <p style="margin: 8px 0 0 0;">
        Por favor, responda com <strong>OK</strong> ou sugira ajustes até <strong>${formatDate(responseDeadline)}</strong>.
      </p>
    </div>

    <p style="margin-top: 24px;">Qualquer dúvida, estou à disposição.</p>

    <p style="margin-bottom: 0;">Abraço,<br><strong>Leonardo Graciano</strong><br>W1 Planejamento Financeiro</p>
  </div>
</body>
</html>
    `.trim();

    const { data: draft, error } = await supabase
      .from('email_drafts')
      .insert({
        client_id: clientId,
        meeting_id: params.meeting_id || null,
        subject,
        html_body: htmlBody
      })
      .select()
      .single();

    if (error) console.warn('Error saving draft:', error);

    if (draft) {
      await triggerWebhooks(WEBHOOK_EVENTS.EMAIL_GENERATED, {
        id: draft.id,
        client_id: clientId,
        client_name: client.name,
        meeting_id: params.meeting_id || null,
        subject,
        has_tasks: pendingTasks.length > 0,
        generated_at: draft.created_at,
      });
    }

    return {
      subject,
      html_body: htmlBody
    };
  } catch (error) {
    console.error('Error in draftEmail:', error);
    throw error;
  }
}
