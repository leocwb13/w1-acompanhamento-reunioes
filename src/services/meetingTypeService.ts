import { supabase } from '../lib/supabase';

export interface MeetingTypeDetails {
  id: string;
  user_id: string | null;
  code: string;
  display_name: string;
  description: string;
  color: string;
  icon: string;
  is_system: boolean;
  is_active: boolean;
  order_position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingTypeInput {
  code: string;
  display_name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateMeetingTypeInput {
  display_name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  order_position?: number;
}

const MAX_CUSTOM_TYPES = 10;
const RESERVED_CODES = ['C1', 'C2', 'C3', 'C4', 'FUP'];

export async function getAllMeetingTypes(): Promise<MeetingTypeDetails[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('meeting_types')
      .select('*')
      .or(`is_system.eq.true,user_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('order_position', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching meeting types:', error);
    throw error;
  }
}

export async function getActiveMeetingTypes(): Promise<MeetingTypeDetails[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('meeting_types')
      .select('*')
      .or(`is_system.eq.true,user_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('order_position', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active meeting types:', error);
    throw error;
  }
}

export async function countCustomMeetingTypes(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { count, error } = await supabase
      .from('meeting_types')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_system', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error counting custom meeting types:', error);
    throw error;
  }
}

function validateCode(code: string): void {
  if (!code || code.length < 2 || code.length > 10) {
    throw new Error('Código deve ter entre 2 e 10 caracteres');
  }

  if (!/^[A-Z0-9_]+$/.test(code)) {
    throw new Error('Código deve conter apenas letras maiúsculas, números e underscores');
  }

  if (RESERVED_CODES.includes(code.toUpperCase())) {
    throw new Error(`Código ${code} é reservado do sistema`);
  }
}

export async function createMeetingType(input: CreateMeetingTypeInput): Promise<MeetingTypeDetails> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    validateCode(input.code);

    const count = await countCustomMeetingTypes();
    if (count >= MAX_CUSTOM_TYPES) {
      throw new Error(`Limite de ${MAX_CUSTOM_TYPES} tipos customizados atingido`);
    }

    const { data: existing } = await supabase
      .from('meeting_types')
      .select('id')
      .eq('user_id', user.id)
      .eq('code', input.code.toUpperCase())
      .maybeSingle();

    if (existing) {
      throw new Error('Já existe um tipo com este código');
    }

    const { data, error } = await supabase
      .from('meeting_types')
      .insert({
        user_id: user.id,
        code: input.code.toUpperCase(),
        display_name: input.display_name,
        description: input.description || '',
        color: input.color || '#3B82F6',
        icon: input.icon || 'Calendar',
        is_system: false,
        is_active: true,
        order_position: count + 10
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating meeting type:', error);
    throw error;
  }
}

export async function updateMeetingType(id: string, input: UpdateMeetingTypeInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: existing } = await supabase
      .from('meeting_types')
      .select('is_system, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      throw new Error('Tipo de reunião não encontrado');
    }

    if (existing.is_system) {
      throw new Error('Não é possível editar tipos do sistema');
    }

    if (existing.user_id !== user.id) {
      throw new Error('Você não tem permissão para editar este tipo');
    }

    const { error } = await supabase
      .from('meeting_types')
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating meeting type:', error);
    throw error;
  }
}

export async function toggleMeetingTypeStatus(id: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: existing } = await supabase
      .from('meeting_types')
      .select('is_system, is_active, user_id, code')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      throw new Error('Tipo de reunião não encontrado');
    }

    if (existing.is_system) {
      throw new Error('Não é possível desativar tipos do sistema');
    }

    if (existing.user_id !== user.id) {
      throw new Error('Você não tem permissão para modificar este tipo');
    }

    if (existing.is_active) {
      const { count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .eq('type', existing.code);

      if (count && count > 0) {
        throw new Error('Não é possível desativar tipo com reuniões associadas');
      }
    }

    const { error } = await supabase
      .from('meeting_types')
      .update({
        is_active: !existing.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling meeting type status:', error);
    throw error;
  }
}

export async function reorderMeetingTypes(types: { id: string; order_position: number }[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    for (const type of types) {
      await supabase
        .from('meeting_types')
        .update({
          order_position: type.order_position,
          updated_at: new Date().toISOString()
        })
        .eq('id', type.id)
        .eq('user_id', user.id)
        .eq('is_system', false);
    }
  } catch (error) {
    console.error('Error reordering meeting types:', error);
    throw error;
  }
}
