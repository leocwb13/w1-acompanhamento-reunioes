import { supabase } from '../lib/supabase';
import type { MeetingType } from '../lib/database.types';

export interface PromptTemplate {
  id: string;
  user_id: string | null;
  meeting_type: MeetingType;
  system_prompt: string;
  summary_instructions: string;
  task_generation_instructions: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPromptTemplate(userId: string, meetingType: MeetingType): Promise<PromptTemplate | null> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('meeting_type', meetingType)
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .order('user_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching prompt template:', error);
    return null;
  }

  return data;
}

export async function getUserPromptTemplates(userId: string): Promise<PromptTemplate[]> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('user_id', userId)
    .order('meeting_type');

  if (error) {
    console.error('Error fetching user prompt templates:', error);
    return [];
  }

  return data || [];
}

export async function getDefaultPromptTemplates(): Promise<PromptTemplate[]> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('is_default', true)
    .order('meeting_type');

  if (error) {
    console.error('Error fetching default prompt templates:', error);
    return [];
  }

  return data || [];
}

export async function createOrUpdatePromptTemplate(
  userId: string,
  meetingType: MeetingType,
  template: {
    system_prompt: string;
    summary_instructions: string;
    task_generation_instructions: string;
  }
): Promise<void> {
  const existing = await supabase
    .from('prompt_templates')
    .select('id')
    .eq('user_id', userId)
    .eq('meeting_type', meetingType)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from('prompt_templates')
      .update({
        ...template,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.data.id);

    if (error) {
      console.error('Error updating prompt template:', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('prompt_templates')
      .insert({
        user_id: userId,
        meeting_type: meetingType,
        ...template,
        is_default: false,
      });

    if (error) {
      console.error('Error creating prompt template:', error);
      throw error;
    }
  }
}

export async function deletePromptTemplate(userId: string, meetingType: MeetingType): Promise<void> {
  const { error } = await supabase
    .from('prompt_templates')
    .delete()
    .eq('user_id', userId)
    .eq('meeting_type', meetingType);

  if (error) {
    console.error('Error deleting prompt template:', error);
    throw error;
  }
}

export async function resetToDefaultPrompt(userId: string, meetingType: MeetingType): Promise<void> {
  await deletePromptTemplate(userId, meetingType);
}
