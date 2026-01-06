import { useState, useEffect } from 'react';
import { Save, RotateCcw, FileText } from 'lucide-react';
import { getUserPromptTemplates, getDefaultPromptTemplates, createOrUpdatePromptTemplate, resetToDefaultPrompt } from '../services/promptService';
import { getAllMeetingTypes, type MeetingTypeDetails } from '../services/meetingTypeService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../lib/toast';
import type { MeetingType } from '../lib/database.types';

export default function PromptEditor() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeDetails[]>([]);
  const [selectedType, setSelectedType] = useState<MeetingType>('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [summaryInstructions, setSummaryInstructions] = useState('');
  const [taskGenerationInstructions, setTaskGenerationInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>([]);

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadMeetingTypes = async () => {
    try {
      const types = await getAllMeetingTypes();
      setMeetingTypes(types);
      if (types.length > 0 && !selectedType) {
        setSelectedType(types[0].code);
      }
    } catch (error) {
      console.error('Error loading meeting types:', error);
    }
  };

  useEffect(() => {
    loadCurrentTemplate();
  }, [selectedType, userTemplates, defaultTemplates]);

  const loadTemplates = async () => {
    if (!user) return;

    const [userTmpls, defaultTmpls] = await Promise.all([
      getUserPromptTemplates(user.id),
      getDefaultPromptTemplates(),
    ]);

    setUserTemplates(userTmpls);
    setDefaultTemplates(defaultTmpls);
  };

  const loadCurrentTemplate = () => {
    const userTemplate = userTemplates.find(t => t.meeting_type === selectedType);
    const defaultTemplate = defaultTemplates.find(t => t.meeting_type === selectedType);
    const template = userTemplate || defaultTemplate;

    if (template) {
      setSystemPrompt(template.system_prompt);
      setSummaryInstructions(template.summary_instructions);
      setTaskGenerationInstructions(template.task_generation_instructions);
      setHasChanges(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await createOrUpdatePromptTemplate(user.id, selectedType, {
        system_prompt: systemPrompt,
        summary_instructions: summaryInstructions,
        task_generation_instructions: taskGenerationInstructions,
      });

      await loadTemplates();
      setHasChanges(false);
      showToast('Prompt salvo com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao salvar prompt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Deseja realmente restaurar o prompt padrão? Suas alterações serão perdidas.')) {
      return;
    }

    setLoading(true);
    try {
      await resetToDefaultPrompt(user.id, selectedType);
      await loadTemplates();
      showToast('Prompt restaurado para o padrão', 'success');
    } catch (error) {
      showToast('Erro ao restaurar prompt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Personalizar Prompts por Tipo de Reunião</h3>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Personalize as instruções que o assistente IA usa para processar cada tipo de reunião.
          Você pode customizar como ele gera resumos, decisões e tarefas para cada situação.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Reunião
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as MeetingType)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {meetingTypes.map((type) => (
            <option key={type.id} value={type.code}>
              {type.display_name} - {type.description}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prompt do Sistema
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            handleChange();
          }}
          placeholder="Descreva o papel e contexto do assistente para este tipo de reunião..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          Define o contexto e papel do assistente para este tipo de reunião
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instruções para Resumo
        </label>
        <textarea
          value={summaryInstructions}
          onChange={(e) => {
            setSummaryInstructions(e.target.value);
            handleChange();
          }}
          placeholder="Como o resumo deve ser estruturado..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          Como o assistente deve criar o resumo executivo da reunião
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instruções para Geração de Tarefas
        </label>
        <textarea
          value={taskGenerationInstructions}
          onChange={(e) => {
            setTaskGenerationInstructions(e.target.value);
            handleChange();
          }}
          placeholder="Que tipo de tarefas devem ser sugeridas..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          Que tipo de tarefas o assistente deve sugerir para este tipo de reunião
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          disabled={loading}
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar Padrão
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          disabled={loading || !hasChanges}
        >
          <Save className="w-4 h-4" />
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
