import { supabase } from '../lib/supabase';

export interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  user_id: string | null;
  updated_at: string;
}

export async function getSetting(key: string, userId?: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = userId || user?.id;

    if (effectiveUserId) {
      const { data: userSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (userSetting?.value) {
        return userSetting.value;
      }
    }

    const { data: globalSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .is('user_id', null)
      .maybeSingle();

    return globalSetting?.value || null;
  } catch (error) {
    console.error('Error getting setting:', error);
    return null;
  }
}

export async function getAllSettings(): Promise<Setting[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .order('key');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting settings:', error);
    return [];
  }
}

export async function updateSetting(key: string, value: string, description?: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    if (!value || value.trim() === '') {
      throw new Error('Valor da configuração não pode estar vazio');
    }

    const { data: existing, error: selectError } = await supabase
      .from('settings')
      .select('id')
      .eq('key', key)
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking existing setting:', selectError);
      throw selectError;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('settings')
        .update({
          value: value.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating setting:', updateError);
        throw updateError;
      }
    } else {
      const defaultDescriptions: Record<string, string> = {
        'openai_api_key': 'Sua chave de API da OpenAI',
        'openai_model': 'Modelo GPT-4 a ser usado',
        'openai_embedding_model': 'Modelo de embeddings para busca semântica'
      };

      const { error: insertError } = await supabase
        .from('settings')
        .insert({
          key,
          value: value.trim(),
          user_id: user.id,
          description: description || defaultDescriptions[key] || null
        });

      if (insertError) {
        console.error('Error inserting setting:', insertError);
        throw insertError;
      }
    }
  } catch (error) {
    console.error('Error in updateSetting:', error);
    throw error;
  }
}

export async function getOpenAIKey(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.value && data.value.trim() !== '' && data.value !== 'your_openai_api_key_here') {
        console.log('[OpenAI Key] Usando chave pessoal do usuário');
        return data.value;
      }
    }

    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    console.log('[OpenAI Key] Verificando chave do .env:', envKey ? `Encontrada (${envKey.substring(0, 10)}...)` : 'Não encontrada');

    if (envKey && envKey.trim() !== '' && envKey !== 'your_openai_api_key_here') {
      console.log('[OpenAI Key] Usando chave do sistema (.env)');
      return envKey;
    }

    console.log('[OpenAI Key] Nenhuma chave configurada');
    return null;
  } catch (error) {
    console.error('Error getting OpenAI key:', error);
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (envKey && envKey.trim() !== '' && envKey !== 'your_openai_api_key_here') {
      console.log('[OpenAI Key] Usando chave do .env (após erro)');
      return envKey;
    }
    return null;
  }
}

export async function initializeUserSettings(userId: string): Promise<void> {
  try {
    const defaultSettings = [
      { key: 'openai_model', value: 'gpt-5-nano', description: 'Modelo GPT a ser usado' },
      { key: 'openai_embedding_model', value: 'text-embedding-3-small', description: 'Modelo de embeddings' }
    ];

    for (const setting of defaultSettings) {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', setting.key)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('settings').insert({
          ...setting,
          user_id: userId
        });
      }
    }
  } catch (error) {
    console.error('Error initializing user settings:', error);
  }
}
